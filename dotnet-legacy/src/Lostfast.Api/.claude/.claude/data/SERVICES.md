# Services & Capabilities in this Project

## Core Skills (in .claude/skills/)
- **fd**: Fast file search and command execution alternative to `find`. Loaded for filesystem tasks. See fd.md.
- **firecrawl**: Web scraping, search, crawling, AI extraction via CLI. See firecrawl.md.
- **skill-creator**: Full guide + scripts to create new skills (init, package, validate). See skill-creator/SKILL.md.

## Agent Features Used
- Built-in tools: glob, grep, read, edit, write, bash, task (sub-agents), websearch, webfetch, suggest, etc.
- Custom via `skill` tool for complex/repetitive domains.
- Git integration for commits (only when explicitly requested).

## Project Services
- Custom instruction framework for consistent, context-aware coding sessions.
- Error and task iteration tracking with -impl folders.
- Self-improvement loop for the .claude meta-project.

No external production services; this is tooling for the AI agent itself.
