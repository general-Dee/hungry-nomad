# Your Agent System (Manager → Specialists)

Built on Dan Martell's framework from *"You're Not Behind (Yet): How to Build Your First AI Agent"*.

The core idea:
- **One Manager agent** per domain. It never does the work itself — it only routes jobs to the right specialist.
- **Specialist agents**, each with ONE job and ONE lane. A specialist never steps outside its lane.
- **Identity** for every agent = SOUL (why it exists / its standards) + IDENTITY (its one job, its boundaries) + USER (context about you and the business it serves).

In Claude Code, this maps directly onto real product primitives:
- The **Manager** = your root `CLAUDE.md` in each project folder. That's what the main Claude Code session reads automatically, and it's written to behave like the Manager: route, don't do.
- The **Specialists** = individual files in `.claude/agents/`. Each one is a self-contained subagent — its own system prompt (SOUL + IDENTITY + USER folded into the markdown body), its own tools, its own context window. Claude Code delegates to these automatically based on the `description` field, or you can call them by name.

## Two folders, two domains

```
agent-system/
  coding-agents/
    CLAUDE.md                      ← Manager: coding
    .claude/agents/
      code-reviewer.md
      bug-fixer.md
      feature-builder.md
      test-writer.md
      docs-writer.md
  marketing-agents/
    CLAUDE.md                      ← Manager: Scale-Edge Marketing LTD / LinkedIn
    .claude/agents/
      linkedin-content-writer.md
      linkedin-outreach.md
      discovery-call-prep.md
      lead-researcher.md
```

## How to use this

1. Copy `coding-agents/` into the root of an actual code repo you work in (or point Claude Code at it with `--add-dir`). Rename it to whatever you like — Claude Code just needs `CLAUDE.md` and `.claude/agents/` at the top level.
2. Copy `marketing-agents/` into its own folder for Scale-Edge's LinkedIn operation — same rule.
3. Open Claude Code inside that folder. It reads `CLAUDE.md` on start and loads every file in `.claude/agents/`.
4. Just talk to it like you would the Manager: "A prospect replied to our DM, draft the follow-up" or "the signup form is throwing a 500, fix it." The Manager routes to the right specialist.
5. **Subagents load at session start.** If you edit a file in `.claude/agents/`, restart the session to pick up the change (unless you edit through the `/agents` command, which applies immediately).

## Customizing

Each specialist file has a `USER` section at the top of its body — that's where business/personal context lives (who you are, what "good" looks like for this business, tone, constraints). I've pre-filled what I know about Scale-Edge and your LinkedIn playbook. The coding-agent USER sections are generic — fill in your actual stack, repo conventions, and standards once you drop these into a real project, and they'll get sharper fast.

Want me to also generate the SOUL/IDENTITY/USER files as three separate documents per agent (closer to the video's literal structure) instead of the folded-in version? Say the word and I'll restructure.
