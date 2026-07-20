# Review Template

Use this for design review, architecture review, and final implementation review.

```md
Review Result

Findings:
1. ...

Open Questions / Assumptions:
- ...

Verdict:
- Approved / Revisions Required

Reason:
- ...

Required Fixes:
- ...

Workflow State:
- ...

Exact Next Step:
- ...

<!-- ai-workflow-record:v1
{"type":"review_result","card":146,"worker":"chatgpt-reviewer","role":"qa-reviewer","artifact":"pr:self#147","head":"0123456789abcdef0123456789abcdef01234567","result":"approved","supersedes":null}
-->
```

Machine records fix `worker` to `chatgpt-reviewer` and `role` to `qa-reviewer`. `result` is exactly `approved` or `revisions_required` (`approved_with_conditions` is not a machine enum member). Every governed review comment must include exactly one `ai-workflow-record:v1` marker.
