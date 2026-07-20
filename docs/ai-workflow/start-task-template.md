# Start Task Template

Use this before any design, ADR, or implementation work begins.

```md
Start Task

Task:
Goal:
Acceptance Criteria:
Files Expected To Change:
Dependencies:
Authority:
- Issue:
- Design:
- ADR:
- Prior PRs:
- Workflow docs:

Risks:
Estimated Deliverables:
Exact Stop Condition:
- Stop at review-ready state / stop at approval gate / stop at merged closeout

<!-- ai-workflow-record:v1
{"type":"start_task","card":146,"worker":"cursor","role":"gameplay-engineer","artifact":null,"head":null,"result":null,"supersedes":null}
-->
```

Every governed Start Task comment must include exactly one `ai-workflow-record:v1` marker. Legacy prose comments without a marker remain historically readable but are not machine records.
