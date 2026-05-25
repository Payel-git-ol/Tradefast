# This folder describes the tasks.

Files tasks structure:
  ```text
  Task title: 
  Lead time: <::> / <::>
  Resources (optional): 
    -
    -
  Project resources (optional):
    -
    -
  Description:
    -
  ```


# Task creation and iteration rule
  This block is critical — follow it strictly.
  If a user creates or reports a task and stores it under /.claude/tasks/<NAME_FOLDER>/, then:
  On the first implementation/processing of the task create an implementation folder: /.claude/tasks/<NAME_FOLDER>-impl/.
  If a second iteration is required (further work, new requirements, or the task is not fully resolved), create the next nested iteration: /.claude/tasks/<NAME_FOLDER>-impl-2/.
  For subsequent iterations increase the numeric suffix: -impl-3, -impl-4, etc.
  Iterations may be nested when it makes sense for the workflow. Example structure:

  ```
  /.claude/tasks/frontend-feature/
  /.claude/tasks/frontend-feature-impl/
  /.claude/tasks/frontend-feature-impl-2/
  ```

  Folder naming guidelines:
  Keep names short, descriptive, and human-readable (e.g., frontend-feature, api-auth, deploy-ci).
  Use hyphens to separate words; avoid spaces and special characters.
  Numbering rules:
    The first rework always uses the -impl suffix.
    Each subsequent rework increments the number: -impl-2, -impl-3, ...
    Do not skip numbers; maintain a contiguous sequence.
    Completion and status:
    When an iteration is fully completed and the task is closed, add a status marker (for example, a file named STATUS: done or status.md with “done”) inside the iteration folder and record a short summary of changes.
    Contents of each iteration folder:
    Brief goal/description, list of changes, links to related discussions, PRs, or tickets, and a timestamp/author.
  Branching:
    If a task splits into independent tracks (for example, frontend and backend), create separate root folders: /.claude/tasks/<NAME_FOLDER>-frontend/ and /.claude/tasks/<NAME_FOLDER>-backend/. Each track gets its own -impl iterations.

  Example names:

  ```
  /.claude/tasks/api-auth/
  /.claude/tasks/api-auth-impl/
  /.claude/tasks/api-auth-impl-2/
  ```