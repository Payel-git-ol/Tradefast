Task title: lostfast-mvp-skeleton — Реализация первого MVP-скелета Lostfast
Lead time: 2026-05-25 18:00 / 2026-05-25 18:25

Status: done (первый срез скелета готов и компилируется)

Что было создано в этой итерации:

**Структура проектов (Clean Architecture)**
- src/Lostfast.Domain/
- src/Lostfast.Application/
- src/Lostfast.Infrastructure/
- src/Lostfast.Api/
- tests/ (заготовка)

Все 4 проекта добавлены в Lostfast.sln с правильными ссылками (Domain ← Application ← Infrastructure ← Api).

**Domain (первые сущности и value objects)**
- Common/ValueObjects/Symbol.cs (immutable, валидация)
- Common/ValueObjects/Money.cs (immutable, арифметика, currency safety)
- Journal/Trade.cs (первый агрегат — Open/Close, теги)
- Risk/RiskLimit.cs (DailyLossLimit, MaxPositionSize, MaxDrawdown, Activate/Deactivate)

**Application**
- Common/Interfaces/IPreTradeRiskValidator.cs + RiskCheckResult (контракт самого важного gate)
- Journal/Commands/LogTradeCommandHandler.cs (первый use case)
- Risk/Commands/CheckTradeRiskCommandHandler.cs (использует validator)

**Infrastructure (MVP)**
- Persistence/LostfastDbContext.cs (Trades + RiskLimits)
- Persistence/StubPreTradeRiskValidator.cs (заглушка — всегда approve, с предупреждением)

**Api**
- Program.cs (чистый, с регистрацией validator + handler + InMemory EF)
- Controllers/RiskController.cs (POST /api/risk/check-trade — демонстрация risk gate)

**Дополнительно**
- Установлены EF Core 9 + InMemory provider (временно, для быстрого старта)
- Решение полностью собирается без предупреждений

**Следующие шаги (рекомендация)**
1. Добавить реальную PostgreSQL + миграции (Npgsql + EF migrations).
2. Реализовать настоящий RiskValidator (с учётом текущего exposure, daily PnL и т.д.).
3. Добавить JournalEntry, RiskDecision, immutable audit.
4. Добавить SignalR + первые хабы.
5. Перейти к Signals bounded context.

Все изменения закоммичены. Готов к следующей итерации или уточнениям.

**Важное решение пользователя (записано для контекста агента):**
- Полностью убрать версионирование API (/v1/, /v2/ и т.д.) на текущем этапе и в ближайшее время.
- Использовать только плоские пути: /api/risk, /api/journal и т.д.
- Не вставлять /v1/ ни в код, ни в документацию, ни в контекст задач.
- Это правило действует до явной отмены пользователем.
