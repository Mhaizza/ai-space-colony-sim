# Handoff Template

Use this when transferring an in-progress card from the effective worker to the next worker.

```md
Handoff

Card:
From Worker:
From Role:
To Worker:
To Role:
Reason:
Authority:
- Issue:
- Design:
- ADR:
- Prior PRs:
- Workflow docs:

Exact Next Step:
- next worker posts Start Task only if required by Human / continue from current phase

<!-- ai-workflow-record:v1
{"type":"handoff","card":146,"worker":"claude","role":"technical-director","artifact":null,"head":null,"result":null,"supersedes":5027448252}
-->
```

`supersedes` must reference the GitHub comment id of the currently effective assignment record (`start_task` or prior `handoff`). Every governed handoff comment must include exactly one `ai-workflow-record:v1` marker.
