Task title: lostfast-mvp-skeleton — Реализация MVP-скелета Lostfast
Lead time: 2026-05-25 18:00 / ongoing

Plan (MVP-first, Risk + Journal как ядро):
1. Создать task tracking (START — сделано, PLAN — текущий, context/, FINAL по завершении итерации).
2. Предложить и создать структуру папок/проектов Clean Architecture в существующем решении Lostfast.sln.
3. Создать Domain проект: базовые value objects + первые сущности (Trade, JournalEntry, RiskLimit, RiskDecision и т.д.).
4. Создать Application проект: интерфейсы (IRepository, IRiskValidator и т.д.) + первые use cases (PreTradeCheck, LogJournalEntry).
5. Создать Infrastructure проект: EF Core конфигурация, первые репозитории (заглушки), DbContext.
6. Создать Api проект (ASP.NET Core Web API) с минимальным контроллером и middleware PreTradeValidator.
7. Обновить .sln, csproj ссылки, Docker/compose при необходимости.
8. После каждого логического блока — коммит.
9. В FINAL.md зафиксировать все созданные файлы, строки, структуру.
10. Следующая итерация (после одобрения) — Signals + SignalR + реальный RiskEngine.

Приоритеты этой итерации:
- Только Risk + Journal bounded contexts.
- Никакого AI, Strategy, MarketData в первом срезе.
- Максимальная простота + возможность расширения.
- Обязательно: PreTradeValidator как gate.

Допущения:
- Будем добавлять проекты в существующее решение Lostfast.sln.
- Используем .NET 10, ASP.NET Core Web API.
- EF Core + Npgsql (PostgreSQL) — как рекомендовано в дизайне.
- Пока без реальной миграции БД (на следующем шаге).
