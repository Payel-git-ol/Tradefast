# Various errors that arose during development are described here.

File context structure:
  ```text
  Error title: 
  Lead time: <::> / <::>
  Grade: level: 1..10 / priority: 1..10
  Error:
    - 
    - 

  ```

# Grade:
The error grade depends on the complexity of its solution and its priority.
For example, a syntax error is 10/10, a Docker build error is also 10/10, a logical error, for example, is 6/8, etc.

# It is possible to work in the chat and not through ERROR.md, but then you will need to describe this problem on behalf of the user.
  Error reporting and iteration rule
  This block is critical — follow it strictly.
  If a user reports an error and stores it under /.claude/errors/<NAME_FOLDER>/, then:
  On the first fix/attempt create a fix implementation folder: /.claude/errors/<NAME_FOLDER>-impl/.
  If further fixes or improvements are needed, create the next nested iteration: /.claude/errors/<NAME_FOLDER>-impl-2/.
  Continue increasing the numeric suffix for subsequent iterations: -impl-3, -impl-4, etc.
  Iterations may be nested to reflect the sequence of fixes. Example structure:

  ```
  /.claude/errors/frontend-error/
  /.claude/errors/frontend-error-impl/
  /.claude/errors/frontend-error-impl-2/
  ```

  Folder naming guidelines:
    Use concise, descriptive names for errors (e.g., frontend-crash, api-502, db-migration-fail).
    Keep names readable, use hyphens, avoid spaces and special characters.
    Numbering rules:
    First fix uses -impl.
    Each subsequent fix increments the number and must follow sequential order.
    Completion and status:
    When an iteration resolves the error, mark the iteration as closed (for example, STATUS: fixed or status.md stating “fixed”) and include a brief postmortem or summary of the fix.
    Contents of each iteration folder:
    Bug description and reproduction steps, root cause analysis, list of changes and commits, test results or screenshots, related issue/PR links, and timestamp/author.
    If the reported issue turns into multiple independent bugs, create separate error folders for each (e.g., /.claude/errors/frontend-timeout/, /.claude/errors/login-redirect/) and track their own -impl iterations.

  Example:

    ```
    /.claude/errors/api-502/
    /.claude/errors/api-502-impl/ (attempt 1 — temporary mitigation)
    /.claude/errors/api-502-impl-2/ (attempt 2 — root cause fix)
    ```

# Accepted Files Rule:
Allowed files for error descriptions are 
- .md
- .html