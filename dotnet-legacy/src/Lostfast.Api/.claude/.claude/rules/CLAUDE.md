# Note: The user sent this folder and you found this file. You need to study it and adhere to these rules.

# General rules:
- Write small files, preferably no more than 200 lines.
- Write code that is as clear as possible.
- Speak Russian when the user communicates in Russian or explicitly requests it (aligns with INTERIORWORK exception and main English context).
- Commit every significant change, but avoid committing errors whenever possible.

# Refactoring rule:
- The user says they need to split file ```<N>``` because the file is probably large.
  The file splitting algorithm is as follows:
  ```text
  Every file contains some functions in any case. You take the file you need to split, read it, and then

  delete one function, a router, a class—it doesn't matter—and move it to another file. Then you come back and repeat the process until you've split the file completely, then check for errors if there are any.
  ```

# Deploy rule:
- When a user sends something like this: ```[root@vds1669329 CrewAi]#``` , it means that 
  the user is on the server and needs to be given the necessary commands if something is broken or 
  something needs to be checked. If it's code-related, you need to fix it locally and then push it.
  Exceptions (env files)

# Research rule:
- Before using any library, tool or command from skills — first read the corresponding skill file in `.claude/skills/` (e.g. `fd.md` for file search, `firecrawl.md` for web).
- For searching files in the project: read `.claude/skills/fd.md`, then use the `fd` command in bash.
- If a resource link is specified in the task — first apply/read the skill (firecrawl), save result to `.claude/docs`, study it, then use.

# Context rules:
- In each new session, create a folder in the ```.claude\tasks``` directory and in ```.claude\context``` with the name of the task you will be working on.
- ```.claude\tasks```:
  Then, create an .md file called ```START.md``` and describe the task itself.
  After that, create ```PLAN.md```, where you describe the plan you'll follow.
  Then, create ```FINAL.md```, where you describe the steps you've completed and the files you've changed, their lines, and possibly any details.
  Here we will describe the style of recording tasks, etc 
  [.claude\tasks\CLAUDE.md].
- The user can refine any details. You can update ```PLAN.md``` by adding new steps and finalizing ```FINAL.md```.
   ```.claude\context```:
- After reading the context, look at the git history
- Here, create a file with the name of the task, what you thought you were doing, what files you changed,
  what rules you followed, etc., and the file format is md. [.claude\context\CLAUDE.md]
- After completing the task (by creating a ```commit```), you create a new folder and complete the previous step.

# Errors rule: 
- Once an error is read, its solution becomes a priority.

# Skills rules:
- When user requests a new or improved skill:
  1. Check ```.claude/skills/``` for existing patterns.
  2. Create small .md file (≤200 lines) in ```.claude/skills/```.
  3. Skill must be in English, general, example-heavy, no project-specific code.
  4. Document in this file when and how to load it via the `skill` tool.
  5. Commit the skill file.

# Rules for communication with the user:
- When you're working with a user, you might accidentally forget about the rules while concentrating on them, but that's a mistake. You shouldn't always remember the rules, and especially the context, because the chat with the user is temporary and can become clogged with garbage, and the context you enter is a guarantee of effective work.

# Refresh rule:
- Read this file periodically while updating your context to remember the rules listed above.
  I suggest doing this after each context update.
