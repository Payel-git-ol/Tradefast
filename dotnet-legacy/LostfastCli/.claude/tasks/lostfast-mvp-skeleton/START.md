Task title: lostfast-mvp-skeleton — Реализация первого MVP-скелета Lostfast (Clean Architecture)
Lead time: 2026-05-25 18:00 / ongoing
Resources:
  - .claude/promts/PROMT.md (текущая задача + формат ответов)
  - .claude/tasks/lostfast-mvp-architecture/FINAL.md (утверждённый дизайн: 8 пунктов + Risk + Journal как приоритет)
  - Текущее состояние: только LostfastCli (console Hello World) + .claude

Description:
- Пользователь: "Давай приступим к коду😊" после получения полного архитектурного дизайна.
- Начинаем реальную реализацию MVP по Clean Architecture.
- Приоритет первого среза (из дизайна): Risk + Journal как самое важное ядро (чтобы сразу защитить от импульсивных решений).
- Порядок по правилам PROMT: сначала структура папок → сущности → интерфейсы → сервисы → API.
- Все файлы маленькие (≤200 строк), production-ready, SRP, чистая архитектура.
- После каждого значимого изменения — коммит (английское сообщение).
- Отвечать на русском, в формате промта (краткий вывод + структурированный план + секции Domain/Application/... + зачем/как/риски).

Project resources:
  - Solution: Lostfast.sln (в корне Lostfast/)
  - Текущий проект: LostfastCli (console) — вероятно будет заменён/дополнен настоящим API проектом.
  - .claude/ embedded внутри LostfastCli (как Content)
