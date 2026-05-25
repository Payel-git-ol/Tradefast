Task title: lostfast-mvp-architecture — Проектирование MVP Lostfast с нуля (по PROMT.md)
Lead time: 2026-05-25 17:58 / 2026-05-25 18:30
Resources:
  - .claude/promts/PROMT.md (основной промт + "Текущая задача" с 8 пунктами)
  - .claude/rules/CLAUDE.md (процесс: START/PLAN/FINAL + коммиты + русский)
  - Текущее состояние проекта: Lostfast.sln + LostfastCli (console .NET 10, Hello World, compose.yaml, .claude embedded)

Description:
- Пользователь отправил PROMT.md с явной текущей задачей: спроектировать Lostfast с нуля, начиная с MVP.
- Требуется предложить строго по списку:
  1. Общая архитектура
  2. Список модулей
  3. Сущности домена
  4. API endpoints
  5. Realtime-события SignalR
  6. Встраивание AI
  7. Безопасный risk-control слой
  8. План разработки по этапам (MVP → v1 → v2)
- Формат ответа: Краткий вывод + допущения + структурированный план с секциями Domain/Application/Infrastructure/API/Realtime/AI/Research/Risk Management.
- Учитывать: Clean Architecture, SOLID, SRP, дисциплина/риск-менеджмент, избегание импульсивности, production-ready.
- После проектирования — обновить FINAL.md + закоммитить.

Project resources:
  - Рабочая папка: Lostfast/ (repo root)
  - Существующий код: минимальный (только Hello World в LostfastCli)
  - .claude/ живёт внутри LostfastCli/ (как Content в csproj)
