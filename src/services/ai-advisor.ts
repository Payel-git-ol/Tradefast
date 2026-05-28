import type { InstrumentConsensus } from './news-consensus.js';
import type { SymbolAnalysis } from './analytics.js';
import type { Forecast } from '../strategies/forecast.js';

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

// --- Correction types ------------------------------------------------------

/** Corrected forecast returned by the AI for a single symbol. */
export interface CorrectedForecast {
  symbol: string;
  tpCorrect: boolean;
  correctedTp: number | null;
  slCorrect: boolean;
  correctedSl: number | null;
  directionCorrect: boolean;
  correctedDirection: string;
  /** WHY the price will move this way — market reasoning, news context, not system critique. */
  reason: string;
}

/** Aggregated correction result across all symbols. */
export interface ValidationResult {
  model: string;
  raw: string;
  corrections: CorrectedForecast[];
  summary: string;
}

/** Everything sent to the AI in a single validation request. */
export interface ValidationInput {
  newsConsensus: InstrumentConsensus[];
  symbolAnalyses: SymbolAnalysis[];
  forecasts: Forecast[];
}

// --- Helpers ---------------------------------------------------------------

function apiKey(): string | undefined {
  return process.env.LOSTFAST_AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
}

function apiUrl(): string {
  return process.env.LOSTFAST_AI_API_URL ?? 'https://api.anthropic.com/v1/messages';
}

function isOpenAiCompatible(url: string): boolean {
  return url.includes('/chat/completions');
}

async function callLlm(
  url: string,
  key: string,
  model: string,
  systemPrompt: string | undefined,
  userMessage: string,
  maxTokens: number,
  signal: AbortSignal,
): Promise<string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (isOpenAiCompatible(url)) {
    headers['Authorization'] = `Bearer ${key}`;
    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userMessage });

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'unknown');
      throw new Error(`API responded ${res.status}: ${errorText}`);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty AI response');
    return text;
  }

  // Anthropic native format
  headers['x-api-key'] = key;
  headers['anthropic-version'] = '2023-06-01';

  const body: Record<string, unknown> = { model, max_tokens: maxTokens };
  if (systemPrompt) body['system'] = systemPrompt;
  body['messages'] = [{ role: 'user', content: userMessage }];

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'unknown');
    throw new Error(`API responded ${res.status}: ${errorText}`);
  }

  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data.content?.map((c) => c.text ?? '').join('').trim();
  if (!text) throw new Error('Empty AI response');
  return text;
}

// --- Heuristic advisor -----------------------------------------------------

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

// --- LLM per-symbol advisor (OpenAI-compatible or Anthropic) ----------------

export class LlmAdvisor implements AiAdvisor {
  readonly model: string;
  private readonly fallback = new HeuristicAdvisor();

  constructor(
    private readonly key = apiKey(),
    private readonly url = apiUrl(),
    model = process.env.LOSTFAST_AI_MODEL ?? 'claude-4.7-opus',
  ) {
    this.model = model;
  }

  async advise(analysis: SymbolAnalysis): Promise<AiInsight> {
    if (!this.key) return this.fallback.advise(analysis);
    try {
      const summary = await callLlm(
        this.url, this.key, this.model,
        undefined,
        buildPrompt(analysis),
        256,
        AbortSignal.timeout(60_000),
      );
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

// --- Correction advisor (single request, all data) --------------------------

const CORRECTION_SYSTEM_PROMPT = `Ты — корректирующий слой торговой системы LostFast. Твоя задача — проверить и исправить TP/SL/направление для каждого символа за один запрос.

Правила:
1. **tpCorrect** — верен ли TP (2:1 риск-доходность, относительно ATR). Если нет — укажи correctedTp.
2. **slCorrect** — верен ли SL (стоп за ATR). Если нет — укажи correctedSl.
3. **directionCorrect** — верно ли направление (long/short). Если нет — укажи correctedDirection.
4. **reason** — кратко на русском: ПОЧЕМУ цена пойдёт в эту сторону (новости, макроэкономика, рыночный контекст). Не пиши что не так с аналитикой системы — напиши почему рынок будет двигаться.

Верни JSON-массив:
[
  {
    "symbol": "BTCUSDT",
    "tpCorrect": true,
    "correctedTp": null,
    "slCorrect": true,
    "correctedSl": null,
    "directionCorrect": true,
    "correctedDirection": "",
    "reason": "Биткоин тестирует сопротивление $74k на фоне снижения ставки ФРС и притока в ETF — пробой вверх вероятен."
  }
]

Если параметр корректен — ставь true и null для corrected*. Если нет — ставь false и новое значение. correctedDirection может быть "long", "short" или "".`;

function buildCorrectionPrompt(input: ValidationInput): string {
  const parts: string[] = [
    '=== НОВОСТНОЙ КОНСЕНСУС (сокращённо) ===',
  ];

  for (const nc of input.newsConsensus) {
    parts.push(`${nc.instrument}: упомянут ${nc.mentions} раз(а), бычьих ${nc.bullish}, медвежьих ${nc.bearish}, нейтральных ${nc.neutral}, смещение ${nc.crowdBias.toFixed(2)}`);
  }

  parts.push('', '=== АНАЛИТИКА И TP/SL ПО СИМВОЛАМ ===');

  for (const sa of input.symbolAnalyses) {
    const a = sa.analytics;
    const f = input.forecasts.find((f) => f.symbol === sa.symbol);
    parts.push(
      `--- ${a.symbol} ---`,
      `Цена: ${a.lastPrice ?? 'N/A'}, ATR: ${a.atr ?? 'N/A'}`,
      `Консенсус: ${a.consensusScore.toFixed(3)} (длинных ${a.longCount}, коротких ${a.shortCount}, нейтральных ${a.neutralCount})`,
      `Сильнейшая стратегия: ${a.strongestStrategy ?? 'нет'} (сила ${((a.strongestStrength ?? 0) * 100).toFixed(0)}%)`,
    );

    for (const ev of sa.evaluated.slice(0, 5)) {
      parts.push(`  ${ev.signal.strategy}: ${ev.signal.direction} (strength ${ev.signal.strength.toFixed(3)}) → ${ev.status}`);
    }

    if (f && f.direction) {
      parts.push(
        `TP/SL расчёт: направление ${f.direction}, entry ${f.entry?.toFixed(2) ?? 'N/A'}`,
        `  TP: ${f.tp?.toFixed(2) ?? 'N/A'}, SL: ${f.sl?.toFixed(2) ?? 'N/A'}, стоп-дистанция: ${f.stopDistance?.toFixed(2) ?? 'N/A'}`,
      );
    } else {
      parts.push('  TP/SL: не расставлен (нет направленного сигнала)');
    }
  }

  return parts.join('\n');
}

export class ValidationAdvisor {
  readonly model: string;

  constructor(
    private readonly key = apiKey(),
    private readonly url = apiUrl(),
    model = process.env.LOSTFAST_AI_MODEL ?? 'claude-4.7-opus',
  ) {
    this.model = model;
  }

  async validate(input: ValidationInput): Promise<ValidationResult> {
    if (!this.key) {
      return {
        model: 'error',
        raw: 'API key not configured',
        corrections: [],
        summary: 'API key not configured — corrections skipped.',
      };
    }

    try {
      const raw = await callLlm(
        this.url, this.key, this.model,
        CORRECTION_SYSTEM_PROMPT,
        buildCorrectionPrompt(input),
        8192,
        AbortSignal.timeout(120_000),
      );

      return this.parseResponse(raw);
    } catch (err) {
      return {
        model: this.model,
        raw: `Correction error: ${err instanceof Error ? err.message : String(err)}`,
        corrections: [],
        summary: 'Correction request failed.',
      };
    }
  }

  private parseResponse(raw: string): ValidationResult {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { model: this.model, raw, corrections: [], summary: raw };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        symbol: string;
        tpCorrect: boolean;
        correctedTp: number | null;
        slCorrect: boolean;
        correctedSl: number | null;
        directionCorrect: boolean;
        correctedDirection: string;
        reason: string;
      }>;

      const corrections: CorrectedForecast[] = parsed.map((v) => ({
        symbol: v.symbol,
        tpCorrect: Boolean(v.tpCorrect),
        correctedTp: v.correctedTp ?? null,
        slCorrect: Boolean(v.slCorrect),
        correctedSl: v.correctedSl ?? null,
        directionCorrect: Boolean(v.directionCorrect),
        correctedDirection: v.correctedDirection ?? '',
        reason: v.reason ?? '',
      }));

      const changed = corrections.filter((c) => !c.tpCorrect || !c.slCorrect || !c.directionCorrect);
      const summary = changed.length === 0
        ? `✅ Все ${corrections.length} символов — коррекции не требуются.`
        : `⚠️ ${changed.length}/${corrections.length} символов — нужна коррекция.`;

      return { model: this.model, raw, corrections, summary };
    } catch {
      return { model: this.model, raw, corrections: [], summary: raw };
    }
  }
}

/** Selects the LLM advisor when a key is configured, else the heuristic one. */
export function createAdvisor(): AiAdvisor {
  return apiKey() ? new LlmAdvisor() : new HeuristicAdvisor();
}