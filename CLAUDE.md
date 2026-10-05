# Model & delegation policy
- Never do multi-step work yourself. Plan, then dispatch a sub-agent for execution.
- Sub-agents default to Opus 5.5. Only escalate a sub-agent to Fable 5.1 for: contract/legal review, deal modeling, multi-entity accounting logic, or anything where a wrong answer costs money.
- Use Opus 5.5 for: file reads, searches, drafts, formatting, summaries, CRM/data lookups, routine copy, SOP writing.
- Return only the finished output plus a 3-line summary. No narration of steps.
- If a task is trivial (one tool call, one edit), just do it — don't spin up a sub-agent for it.
