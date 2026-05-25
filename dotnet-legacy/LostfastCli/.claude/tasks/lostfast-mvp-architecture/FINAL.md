Task title: lostfast-mvp-architecture — Проектирование MVP Lostfast с нуля
Lead time: 2026-05-25 17:58 / 2026-05-25 18:25

Status: done (дизайн полностью подготовлен и отдан пользователю в формате PROMT.md)

Files changed / lines:
- .claude/tasks/lostfast-mvp-architecture/START.md (new, ~35 lines)
- .claude/tasks/lostfast-mvp-architecture/PLAN.md (new, ~30 lines)
- .claude/context/lostfast-mvp-architecture+2026-05-25T18-00.md (new, ~25 lines)
- .claude/tasks/lostfast-mvp-architecture/FINAL.md (this file, ~120 lines with full design)
- (опционально) .claude/docs/ будет использоваться для более детальных спецификаций позже

Commits performed:
- (будут перечислены после фактических git commit)

Полный дизайн (точно в формате, который отдан пользователю):

Краткий вывод
Предлагается модульный монолит на Clean Architecture (ASP.NET Core + SignalR + EF Core) для MVP Lostfast. Главный приоритет — жёсткий risk-control слой и journaling как ядро, которое не даёт действовать импульсивно. AI — исключительно исследовательский помощник (RAG + аналитические агенты) без каких-либо автосоветов или автотрейда. Всё разбито на bounded contexts с чёткими границами.

Допущения
- БД: PostgreSQL (ACID для сделок и journal).
- Кэш/реалтайм state: Redis.
- LLM: внешний (OpenAI/Anthropic или аналог) через HTTP — на MVP без self-hosted.
- Аутентификация: JWT (простая).
- Docker уже заготовлен в compose.yaml — будет использован.
- Нет distributed transactions и event-driven очередей в MVP (появятся в v1).
- Монолит с модульной структурой (лучше для MVP, чем микросервисы).

1. Общая архитектура
Clean Architecture + Modular Monolith (bounded contexts как "модули").
Слои (снизу вверх, зависимости только вниз):
- Domain (чистые сущности, value objects, доменные события, no EF, no external).
- Application (Use Cases / Commands / Queries, interfaces, business rules).
- Infrastructure (EF Core, Repositories impl, SignalR, LLM clients, Exchange adapters, Redis, Logging).
- Presentation (Controllers, SignalR Hubs, DTOs, Middleware).

Модули (bounded contexts) для MVP:
MarketData, Signals, Strategies, Journal, Risk, AIResearch, Notifications, Identity (минимальный).

Вертикальные срезы внутри модулей для быстрых фич (например, "GenerateSignal" slice).

2. Список модулей (MVP)
- MarketData — адаптеры к биржам, нормализация свечей/orderbook/ticker, time-series.
- Signals — индикаторы (TA-Lib или свой), паттерны, composite score, генерация сигналов.
- Strategies — правила, backtesting engine (простой), activation/deactivation.
- Journal — сделки, записи, теги, performance metrics, equity curve.
- Risk — pre-trade validation, exposure calculator, limits engine, kill-switch, audit.
- AIResearch — RAG над journal + market context, scenario analysis, "what-if", insight generation.
- API & Realtime — REST + SignalR hubs.
- Infrastructure cross-cutting: Auth, Logging, Configuration.

3. Сущности домена (ключевые, MVP)
- Symbol (value object)
- Money, Percentage, Quantity, RiskAmount
- Candle, OrderBookSnapshot, Ticker
- Signal (type, strength, timeframe, confidence, source)
- Trade (id, symbol, side, entry/exit, size, pnl, fees, tags, notes)
- JournalEntry (tradeId?, text, mood, lessons, timestamp)
- Position (open trades aggregate)
- RiskLimit (dailyLoss, maxExposure, maxDrawdown, perSymbol)
- RiskDecision (approved/rejected, reason, timestamp, trace)
- Strategy (id, rules json, riskProfile, isActive)
- AIInsight (query, contextIds, response, confidence, riskNote, createdAt)
- Domain events: TradeOpened, RiskBreachDetected, SignalGenerated, AIInsightCreated и т.д.

Aggregates: Journal (root для всех записей), ActiveRiskState, StrategyInstance.

4. API endpoints (MVP, REST, без версионирования)
Market:
GET  /market/{symbol}/candles?timeframe=5m&limit=200
GET  /market/{symbol}/orderbook
GET  /market/tickers

Signals:
POST /signals/generate (body: symbol, timeframe, indicators[])
GET  /signals/active

Strategies:
GET/POST/PUT/DELETE /strategies
POST /strategies/{id}/backtest
POST /strategies/{id}/activate

Journal:
GET/POST /journal/trades
POST /journal/entries (для заметок)
GET  /journal/performance?period=30d

Risk:
GET  /risk/exposure
GET  /risk/limits
POST /risk/check (pre-trade validation — обязателен перед любой "сделкой")
POST /risk/kill-switch (on/off)

AI:
POST /ai/query (RAG + analysis)
POST /ai/scenario (what-if simulation)

Auth:
POST /auth/token

5. Realtime-события (SignalR)
Hubs:
- MarketHub — PriceUpdated, OrderBookUpdated, TickerUpdated
- AlertsHub — RiskBreach, SignalGenerated, KillSwitchActivated
- JournalHub — TradeLogged, PerformanceUpdated
- AIHub — InsightReady (streaming partial responses опционально)

Client groups: по symbol, по strategy, по risk-level.

6. Встраивание AI (Research Assistant, не oracle)
Архитектура:
- Vector store (PgVector или Qdrant на MVP) — embeddings journal entries + market reports + indicator results.
- Retriever (hybrid: semantic + keyword + metadata filters).
- LLM Client (Infrastructure) с structured output (JSON with confidence, risk_note, alternatives).
- Agents (Application layer):
  - ResearchAgent (анализ паттернов, "почему я теряю на BTC?")
  - RiskAdvisor (предлагает ужесточить лимиты, но не "купи")
  - ScenarioSimulator (what-if: "если цена упадёт на 8%")
- Workflow: User query → Context assembly (с обязательным risk context) → LLM → Response + mandatory disclaimer + confidence + suggested filters.
- Все AI-ответы логируются и проходят через risk layer (даже для research).

На MVP: только RAG над собственными данными пользователя + публичным market context. Никакого fine-tuning и live trading signals от AI.

7. Risk-control слой (центральный элемент системы)
- PreTradeValidator (Application service) — вызывается перед любой операцией, которая может привести к сделке.
  Проверки (примеры):
  - Daily loss limit не превышен
  - Current exposure + proposed size <= maxExposure
  - Volatility-adjusted position size
  - Correlation check с уже открытыми позициями
  - Cooling-off period после серии убытков
- RiskEngine (background + realtime) — считает VaR-like метрики, current drawdown, heat map.
- KillSwitch (Aggregate + command) — мгновенно переводит все strategies в inactive, шлёт алерты.
- Immutable RiskAuditLog (отдельная таблица или event store на MVP).
- "Discipline Enforcer" — middleware / decorator, который может отклонять действия и объяснять почему (на русском, чётко).
- Конфигурация risk profiles per user/strategy (aggressive / balanced / conservative).

Риск: пользователь захочет обойти систему → mitigation: audit + UI, который не позволяет "просто поставить галочку".

8. План разработки по этапам

MVP (цель: 4–6 недель, один разработчик)
- Sprint 0: Clean Architecture skeleton + solution structure + Docker.
- Sprint 1: MarketData модуль + PostgreSQL + EF + 2-3 exchange adapters (Binance mock + real).
- Sprint 2: Journal + basic performance metrics + Risk core (limits + pre-trade validator).
- Sprint 3: Signals (простые индикаторы) + first 2 SignalR hubs.
- Sprint 4: AIResearch (RAG только над journal) + basic API surface + JWT.
- Sprint 5: Polish, tests, risk audit, documentation, first backtest.

v1 (после MVP, 2–3 месяца)
- Полноценный Strategy engine + backtester + optimizer.
- Множество exchange adapters + order execution (paper first).
- Advanced risk (scenario stress testing, position correlation matrix).
- Несколько AI agents + evaluation harness.
- Простой Web UI (Blazor Server или отдельный SPA).

v2 (6+ месяцев)
- Event-driven backbone (Outbox + MassTransit или Wolverine).
- Полноценная multi-agent research system с tool use.
- Live trading с жёсткими risk gates + kill-switch на уровне infrastructure.
- Mobile/desktop клиенты, advanced analytics, sharing (анонимно).

Следующие шаги (немедленно после одобрения дизайна)
1. Утвердить эту архитектуру + стек БД.
2. Создать детальную структуру папок и первые 3-4 проекта/модуля.
3. Выбрать конкретные библиотеки (EF + Npgsql, SignalR, Polly для resilience, PgVector или Qdrant, OpenAI SDK и т.д.).
4. Начать с Risk + Journal как самых важных bounded contexts.

Риски и зависимости
- Риск "AI будет давать торговые советы" → жёсткий промпт-инжиниринг + output contracts + UI disclaimers.
- Риск переусложнения → строго vertical slices + "no new module without risk justification".
- Зависимость от качества данных бирж → dedicated validation + resilience layer.
- Эмоциональный риск пользователя → risk layer + journaling как gate на 80% действий.

Готов к уточнениям и переходу к реализации первого среза.
