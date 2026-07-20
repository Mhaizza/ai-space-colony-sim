# Kanban Update / Done Template

Use this for mid-flow Kanban Updates (`Review` | `Blocked`) and terminal closeout (`Done`).

## Shared prose fields

```md
Kanban Update

Card:
Status: Review | Blocked | Done

Completed:
- ...

Changed Files:
- ...

Validation:
- ...

Pipeline Trail:
- issue created
- design / ADR gates
- implementation PR
- review approval
- merge

Scope Delivered:
- ...

Scope Not Delivered:
- ...

Follow-up Tasks:
- ...

Exact Next Step:
- open next card / no further action
```

## Machine record — Review or Blocked (`kanban_update`)

When `Status` is `Review` or `Blocked`, append exactly one marker:

```md
<!-- ai-workflow-record:v1
{"type":"kanban_update","card":146,"worker":"cursor","role":"gameplay-engineer","artifact":null,"head":null,"result":null,"supersedes":null}
-->
```

## Machine record — Done (`completion`)

When `Status` is `Done`, append exactly one marker (`artifact` required; `head` required only for `pr:`):

```md
<!-- ai-workflow-record:v1
{"type":"completion","card":146,"worker":"cursor","role":"gameplay-engineer","artifact":"pr:self#147","head":"0123456789abcdef0123456789abcdef01234567","result":null,"supersedes":null}
-->
```

Post exactly one `ai-workflow-record:v1` marker per GitHub comment. Legacy prose comments without a marker remain historically readable but are not machine records.
