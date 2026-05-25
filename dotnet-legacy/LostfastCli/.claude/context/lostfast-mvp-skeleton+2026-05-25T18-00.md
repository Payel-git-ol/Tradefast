Task title: lostfast-mvp-skeleton — Начало реализации MVP-скелета Lostfast
Lead time: 2026-05-25T18:00 / 2026-05-25T18:15
Resources (optional): 
  - Утверждённый дизайн: .claude/tasks/lostfast-mvp-architecture/FINAL.md
  - Пользователь явно попросил "Давай приступим к коду"

Context:
  - Переход от дизайна к коду.
  - Текущее состояние проекта: минимальный console-приложение + .claude.
  - Цель итерации: создать правильную Clean Architecture структуру + первые 2 bounded contexts (Risk + Journal) как самое важное ядро.
  - Пользователь мотивирован (эмодзи), ожидает реальных файлов и кода.
  - Будем следовать PROMT: структура папок → сущности → интерфейсы → сервисы → API.
  - Обязательно документировать в task tracking и коммитить.

Что планируется сделать в этой сессии:
  - Создать 4 проекта: Domain, Application, Infrastructure, Api
  - Базовые value objects и агрегаты
  - Первые интерфейсы и use case для Risk pre-trade
  - Минимальный ASP.NET проект с контроллером
  - Обновить solution и конфиги

What have you been criticized or praised for (optional):
  - (Предыдущая работа по дизайну + исправление git-ошибки были приняты; теперь ждут кода)
