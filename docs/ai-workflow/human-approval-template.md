# Human Approval Template

Use this for Human acceptance of an exact artifact head (implementation PR or default-branch path).

```md
Human Approval

Card:
Artifact:
Head:
Decision:
- Approved for merge / Accepted ADR / Accepted design
Authority:
- Issue:
- Design:
- ADR:
- Prior PRs:
- Workflow docs:

Exact Next Step:
- merge / continue workflow / request revisions

<!-- ai-workflow-record:v1
{"type":"human_approval","card":146,"worker":"human","role":"human-owner","artifact":"pr:self#147","head":"0123456789abcdef0123456789abcdef01234567","result":null,"supersedes":null}
-->
```

`worker` is always `human` and `role` is always `human-owner`. `artifact` must be `pr:self#…` or `path:self#…` (never `issue:`). Every governed Human approval comment must include exactly one `ai-workflow-record:v1` marker.
