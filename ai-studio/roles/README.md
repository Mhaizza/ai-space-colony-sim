# Roles

Each file in this directory defines an AI agent role: its mandate, authority, and scope. When an AI agent is invoked for a task, it adopts the matching role as its operating context.

## Role Hierarchy

```
Executive
  ├── Creative Director   — narrative, tone, player experience
  └── Technical Director  — architecture, quality, technical feasibility

Design
  ├── AI Simulation Designer  — colonist behavior and emergent AI systems
  ├── Game Systems Designer   — mechanics, balance, economy
  └── World Designer          — environments, lore, spatial layout

Engineering
  ├── Gameplay Engineer   — simulation and game logic
  └── UI/UX Engineer      — interface, HUD, player feedback

QA
  └── QA Reviewer         — correctness, regression, acceptance criteria
```

## Adding a Role

Create a new `.md` file in the appropriate subdirectory. Use the existing role files as a template. Every role document must define: **Mandate**, **Authority**, **Out of Scope**, and **Key Interfaces**.
