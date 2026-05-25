import type { SymbolAnalysis } from './analytics.js';

export interface AiInsight {
  symbol: string;
  model: string;
  summary: string;
  /** Confidence in the range [0, 1]. */
  confidence: number;
}

export interface AiAdvisor {
  readonly model: string;
  advise(analysis: SymbolAnalysis): Promise<AiInsight>;
}

/**
 * A deterministic, dependency-free advisor. It narrates the analytics —
 * consensus, the long/short balance and the strongest strategy — into a plain
 * summary. Because it is pure, it works offline and its output is reproducible
 * for tests. The Anthropic-backed advisor below shares the same interface.
 */
export class HeuristicAdvisor implements AiAdvisor {
  readonly model = 'heuristic-v1';

  async advise(analysis: SymbolAnalysis): Promise<AiInsight> {
    const { analytics: a } = analysis;
    const score = a.consensusScore;
    const bias = score > 0.15 ? 'bullish' : score < -0.15 ? 'bearish' : 'neutral';
    const conviction = Math.min(1, Math.abs(score));
    const strongest = a.strongestStrategy
      ? `${a.strongestStrategy} is the highest-conviction read (${((a.strongestStrength ?? 0) * 100).toFixed(0)}%).`
      : 'No single strategy reached an actionable confidence.';

    const summary =
      `${a.symbol}: ${bias} bias (consensus ${score.toFixed(2)}). ` +
      `${a.longCount} long / ${a.shortCount} short / ${a.neutralCount} neutral across strategies. ` +
      `${strongest}` +
      (a.atr ? ` Volatility (ATR) ≈ ${a.atr.toFixed(2)}.` : '');

    return { symbol: a.symbol, model: this.model, summary, confidence: Number(conviction.toFixed(3)) };
  }
}

/**
 * Anthropic-backed advisor used when `ANTHROPIC_API_KEY` is present. It frames
 * the analytics as a prompt and asks for a concise read. Any failure (no key,
 * network, rate limit) falls back to the heuristic advisor so a run never
 * breaks because of the optional AI dependency.
 */
export class AnthropicAdvisor implements AiAdvisor {
  readonly model: string;
  private readonly fallback = new HeuristicAdvisor();

  constructor(
    private readonly apiKey = process.env.ANTHROPIC_API_KEY,
    model = process.env.LOSTFAST_AI_MODEL ?? 'claude-opus-4-7',
  ) {
    this.model = model;
  }

  async advise(analysis: SymbolAnalysis): Promise<AiInsight> {
    if (!this.apiKey) return this.fallback.advise(analysis);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 256,
          messages: [{ role: 'user', content: buildPrompt(analysis) }],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Anthropic responded ${res.status}`);
      const data = (await res.json()) as { content?: { text?: string }[] };
      const summary = data.content?.map((c) => c.text ?? '').join('').trim();
      if (!summary) throw new Error('Empty AI response');
      const conviction = Math.min(1, Math.abs(analysis.analytics.consensusScore));
      return { symbol: analysis.symbol, model: this.model, summary, confidence: Number(conviction.toFixed(3)) };
    } catch {
      return this.fallback.advise(analysis);
    }
  }
}

function buildPrompt(analysis: SymbolAnalysis): string {
  const a = analysis.analytics;
  return [
    'You are a disciplined trading analyst. In 2-3 sentences, summarise the read for the trader.',
    `Symbol: ${a.symbol}`,
    `Consensus score (-1 bearish .. 1 bullish): ${a.consensusScore.toFixed(3)}`,
    `Strategy votes — long: ${a.longCount}, short: ${a.shortCount}, neutral: ${a.neutralCount}`,
    `Strongest strategy: ${a.strongestStrategy ?? 'none'} (${((a.strongestStrength ?? 0) * 100).toFixed(0)}%)`,
    `Last price: ${a.lastPrice ?? 'n/a'}, ATR: ${a.atr ?? 'n/a'}`,
    'Do not give financial advice; describe the technical posture only.',
  ].join('\n');
}

/** Selects the Anthropic advisor when a key is configured, else the heuristic one. */
export function createAdvisor(): AiAdvisor {
  return process.env.ANTHROPIC_API_KEY ? new AnthropicAdvisor() : new HeuristicAdvisor();
}
