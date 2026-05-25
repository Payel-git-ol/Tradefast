Task title: lostfast-mvp-architecture — Проектирование MVP Lostfast
Lead time: 2026-05-25 17:58 / 2026-05-25 18:30

Plan (следовать PROMT + rules):
1. Создать task tracking (START.md — сделано; PLAN.md — текущий; context/ файл; FINAL.md по завершении).
2. Изучить текущее состояние проекта (выполнено: только skeleton LostfastCli + .claude).
3. Спроектировать полную архитектуру MVP по 8 пунктам из PROMT.md.
4. Использовать требуемые секции: Domain, Application, Infrastructure, API, Realtime, AI/Research, Risk Management.
5. Для каждой идеи указывать: зачем / как реализовать / риски.
6. Предложить структуру папок, сущности, интерфейсы, сервисы, API, события.
7. Разбить на этапы: MVP (ядро + risk + базовый AI) → v1 → v2.
8. Обновить FINAL.md с перечнем всех предложенных артефактов и коммитов.
9. Выполнить коммиты после каждого значимого изменения (только .claude/ + docs).
10. Финальный ответ пользователю — строго в формате PROMT (русский, краткий вывод, structured, без лишнего).

Допущения (для плана):
- MVP — монолит с Clean Architecture (модульный), позже можно разбить.
- Docker + compose уже есть как заготовка.
- БД: PostgreSQL (рекомендация, не указано в стеке).
- AI: через внешние LLM (OpenAI/Anthropic) + локальный RAG позже.

Приоритеты:
- Risk control и journaling — must-have даже в MVP.
- Clean Architecture и SRP — не нарушать с первого дня.
