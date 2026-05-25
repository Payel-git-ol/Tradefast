# Project: Skills / .claude Development

This workspace maintains the custom `./.claude` folder used by the Kilo (and Claude) AI coding agent.

## Purpose
- Provide structured rules, task tracking, error handling, and modular skills for the agent.
- Enable "interior" development of the agent's own instruction set (see INTERIORWORK.md).
- Host reusable skills (fd, firecrawl, skill-creator) that can be loaded via the `skill` tool.

## Key Components
- `data/`: General project info (this file + SERVICES.md) — highest read priority.
- `rules/`: Core behavioral rules the agent must follow.
- `tasks/`, `context/`, `errors/`: Templates and iteration folders for work, context, and bug tracking.
- `skills/`: Detailed usage guides and creation tools for extending agent capabilities.
- `docs/`: (optional) External research/docs, not auto-read.

## Usage
The agent reads in priority order (see .claude/CLAUDE.md) at start of relevant sessions.
Development of .claude itself uses INTERIORWORK.md process.

## Status
Currently in active development / refinement phase (typos, contradictions, empty data fixed iteratively).
