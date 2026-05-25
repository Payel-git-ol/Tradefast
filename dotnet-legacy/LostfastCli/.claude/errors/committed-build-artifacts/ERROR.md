Error title: Accidental commit of .NET build artifacts (obj/) into repo history during .claude initial setup
Lead time: 2026-05-25 17:58 / 2026-05-25 18:05
Grade: level: 7 / priority: 9

Error:
  - During the required post-study commit (rules/CLAUDE.md), `git commit` pulled in the entire staging area which included previously `git add`ed C# build outputs under Lostfast/LostfastCli/obj/
  - .gitignore at repo root (C:/Users/pasaz/PythonProjects/Smart) only had JS/npm rules, missing standard .NET ignores (obj/, bin/, *.suo, etc.)
  - Result: 30+ unwanted build/cache files committed in commit 3328436 (pollutes history, increases clone size, not portable across machines)
  - Root cause: no .NET-specific .gitignore patterns + over-staged files from earlier uncommitted state of the workspace
  - Impact: high (repo hygiene, future clean checkouts, CI noise). Not a code bug but meta-infra error.

Reproduction:
  - git clone ... ; git ls-tree -r --name-only 3328436 | grep obj/

Related files changed in the bad commit:
  - Lostfast/LostfastCli/obj/Debug/... (many AssemblyInfo, cache, assets files)
  - Also pulled good files: full .claude/ + LostfastCli.csproj + Program.cs + compose.yaml

What was done right before:
  - Completed study of .claude per priority order (promts > data > context/tasks > rules)
  - Created START/PLAN/FINAL + context md for "start-project"
  - Executed the commit as mandated ("commit every significant change")
