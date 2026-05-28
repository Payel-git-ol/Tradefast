/** Normalised form — the API's raw {function:{name,arguments}} is flattened here. */
export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** Raw tool-call shape returned by the OpenAI-compatible API. */
interface RawToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCallRequest[];
  tool_call_id?: string;
}

function normaliseToolCalls(raw: unknown): ToolCallRequest[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return (raw as RawToolCall[]).map((tc) => ({
    id: tc.id,
    name: tc.function?.name ?? 'unknown',
    args: safeJsonParse(tc.function?.arguments),
  }));
}

function safeJsonParse(text: string | undefined): Record<string, unknown> {
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Convert internal tool-calls back to the API wire format. */
function toRawToolCalls(tcs: ToolCallRequest[]): RawToolCall[] {
  return tcs.map((tc) => ({
    id: tc.id,
    type: 'function',
    function: { name: tc.name, arguments: JSON.stringify(tc.args) },
  }));
}

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<string>;

const TOOL_DEFINITIONS: { type: string; function: Record<string, unknown> }[] = [
  {
    type: 'function',
    function: {
      name: 'run_start',
      description: 'Run a full analysis of all configured symbols. Clears prior run data, keeps the search table.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_update',
      description: 'Re-analyse and persist only what changed (incremental update).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_backtest',
      description: 'Replay history to measure forecast accuracy (win rate, expectancy).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_news',
      description: 'Crawl configured market news and economic-calendar sources.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_status',
      description: 'Show table counts and the latest run analytics.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_clear',
      description: 'Prune outdated runs (the general search table is preserved).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_strategies',
      description: 'List every available strategy.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_theme',
      description: 'Switch CLI colour theme.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Theme name' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_exchange',
      description: 'Select target exchange (binance, okx, bybit, mexc).',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Exchange name: binance, okx, bybit, mexc' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_operating_mode',
      description: 'Select trading style (long-term, medium-term, scalping).',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Mode name: long-term, medium-term, scalping' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_operating_mode_time',
      description: 'Select trading timeframe (1m, 5m, 10m, 15m, 20m, 30m, 1h, 4h, 1d).',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Timeframe: 1m, 5m, 10m, 15m, 20m, 30m, 1h, 4h, 1d' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_currency',
      description: 'Analyse a single currency in detail (forecast + news sentiment + price chart).',
      parameters: {
        type: 'object',
        properties: { symbol: { type: 'string', description: 'Symbol, e.g. BTCUSDT, ETHUSDT' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_help',
      description: 'Show help listing all available commands.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_exchange',
      description: 'Get the current exchange name (binance, okx, bybit, mexc). Does NOT change anything.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_timeframe',
      description: 'Get the current trading timeframe (1m, 5m, 10m, 15m, 20m, 30m, 1h, 4h, 1d). Does NOT change anything.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mode',
      description: 'Get the current operating mode / trading style (long-term, medium-term, scalping). Does NOT change anything.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_currency',
      description: 'Get the list of tracked currency symbols (e.g. BTCUSDT, ETHUSDT, etc.). Does NOT change anything.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_serching_level',
      description: 'Set research crawling depth: normal (fast), high (deep), max (full graph).',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Level: normal, high, or max' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_ratings_adjust',
      description: 'Adjust a source credibility rating by a grade (e.g. -1 lowers score by 1%). Use after the user gives feedback about a source. The grade is divided by 100 before applying, so -1 = -0.01 score delta.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source title or ID to adjust (e.g. "Хабр", "Investing.com")' },
          grade: { type: 'integer', description: 'Grade adjustment: positive to increase, negative to decrease. Example: -1 lowers by 1%, +5 raises by 5%' },
        },
        required: ['source', 'grade'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_serching_platforms',
      description: 'Open the research platform selector to choose which sources to crawl (calendars, news, Reddit, exchange communities).',
      parameters: {
        type: 'object',
        properties: { groups: { type: 'array', items: { type: 'string' }, description: 'Source group IDs: economic-calendars, news-portals, reddit-communities, exchange-communities' } },
        required: [],
      },
    },
  },
];

const SYSTEM_PROMPT = `Ты — AI-ассистент торговой системы Tradefast. Ты можешь отвечать на вопросы пользователя и выполнять команды CLI через инструменты.

Доступные инструменты — все команды CLI, а также read-only инструменты для проверки текущих настроек:
- get_exchange — узнать текущую биржу
- get_timeframe — узнать текущий таймфрейм
- get_mode — узнать текущий режим торговли
- get_currency — узнать список отслеживаемых символов
- run_serching_level — установить глубину поиска (normal / high / max)
- run_serching_platforms — выбрать группы источников для краулинга
- run_ratings_adjust — изменить рейтинг источника (grade: -1 = -1%, +5 = +5%). Нужен source (название или ID) и grade (целое число).

ВАЖНО ПРО РЕЙТИНГИ: Когда пользователь говорит что-то вроде "Хабр -1", "понизь Хабр", "Хабр плохой источник", "уменьши рейтинг Хабру" или аналогично — используй run_ratings_adjust. Параметр source — это название источника (например "Хабр", "Investing.com", "Reddit CryptoCurrency"), а grade — это целое число со знаком: -1, -2, +2, +5 и т.д. Если пользователь не указал конкретное число, спроси или используй -1 по умолчанию для понижения и +1 для повышения.

Если пользователь просит сделать анализ рынка, показать статус или что-то подобное — используй соответствующий инструмент. Прежде чем спрашивать пользователя о текущих настройках — сначала сам проверь их через get_* инструменты.

Когда ты выполняешь команду — результат возвращается тебе, ты сам его анализируешь и объясняешь пользователю. Дополнительный запрос на валидацию не нужен.

Отвечай пользователю на русском языке, кратко и по делу. Если пользователь пишет не по делу или просто здоровается — поддержи беседу.`;

const MAX_HISTORY = 20;

export class ChatService {
  private history: ChatMessage[] = [];
  private readonly key: string | undefined;
  private readonly url: string;
  readonly model: string;

  constructor() {
    this.key = process.env.TRADEFAST_AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    this.url = process.env.TRADEFAST_AI_API_URL ?? 'https://api.anthropic.com/v1/messages';
    this.model = process.env.TRADEFAST_AI_MODEL ?? 'claude-4.7-opus';
  }

  get enabled(): boolean {
    return !!this.key;
  }

  async chat(message: string, executeTool: ToolExecutor): Promise<string> {
    if (!this.key) {
      return 'AI не настроен — укажи TRADEFAST_AI_API_KEY в .env';
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...this.history,
      { role: 'user', content: message },
    ];

    for (let turn = 0; turn < 10; turn++) {
      const response = await this.callApi(messages);

      if (!response) {
        return 'Ошибка: AI не вернул ответ.';
      }

      const text = response.content as string | null;
      const toolCalls = normaliseToolCalls(response.tool_calls);

      if (toolCalls && toolCalls.length > 0) {
        messages.push({ role: 'assistant', content: text, tool_calls: toolCalls });

        for (const tc of toolCalls) {
          let result: string;
          try {
            result = await executeTool(tc.name, tc.args);
          } catch (err) {
            result = `Error: ${err instanceof Error ? err.message : String(err)}`;
          }
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
        continue;
      }

      const reply = text ?? '...';
      this.history = [...this.history, { role: 'user', content: message }, { role: 'assistant', content: reply }];
      if (this.history.length > MAX_HISTORY) {
        this.history = this.history.slice(-MAX_HISTORY);
      }
      return reply;
    }

    return 'AI: достигнут лимит шагов. Попробуй уточнить запрос.';
  }

  reset(): void {
    this.history = [];
  }

  private async callApi(messages: ChatMessage[]): Promise<Record<string, unknown> | null> {
    const isOpenAi = this.url.includes('/chat/completions');

    if (isOpenAi) {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${this.key}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          messages: messages.map((m) => {
            const msg: Record<string, unknown> = { role: m.role, content: m.content };
            if (m.tool_calls) msg.tool_calls = toRawToolCalls(m.tool_calls);
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
            return msg;
          }),
          tools: TOOL_DEFINITIONS,
          tool_choice: 'auto',
        }),
        signal: AbortSignal.timeout(300_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        throw new Error(`API responded ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as { choices?: { message?: Record<string, unknown> }[] };
      return data.choices?.[0]?.message ?? null;
    }

    // Fallback: Anthropic native (no tools support)
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.key!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: messages.filter((m) => m.role !== 'system' && m.role !== 'tool').map((m) => ({ role: m.role, content: m.content })),
        system: messages.find((m) => m.role === 'system')?.content,
      }),
      signal: AbortSignal.timeout(300_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(`API responded ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as { content?: { text?: string }[] };
    const text = data.content?.map((c) => c.text ?? '').join('').trim() ?? '';
    return { role: 'assistant', content: text };
  }
}
