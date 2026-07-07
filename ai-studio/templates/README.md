# Templates

Blank scaffolds for recurring document types. Copy a template, fill in the placeholders, and place the result in the appropriate directory.

## Available Templates

| File | Output Destination |
|------|--------------------|
| `adr.md` | `ai-studio/adr/NNNN-title.md` |
| `issue.md` | GitHub Issue body |
| `design-spec.md` | `ai-studio/design/` |
| `role.md` | `ai-studio/roles/<group>/` |
| `checklist.md` | `ai-studio/checklists/` |

## How to Use

```
cp templates/adr.md adr/0001-use-ecs-architecture.md
# fill in the placeholders, then commit
```

Do not edit templates to record actual decisions — templates stay blank.
