# Architecture documentation

Diagrams are written in [Mermaid](https://mermaid.js.org/), which GitHub
renders inside Markdown. Edit the text and the diagram updates in the PR diff.
PNG renders in `images/` are generated from the same source for PDF, Word and
slides; regenerate them after editing (see below).

| Page                                                                       | What it covers                                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`current-architecture.md`](current-architecture.md)                       | What runs today: clients, Vercel projects, API services, Neon, cron, CI/CD |
| [`data-flows.md`](data-flows.md)                                           | Today's request paths: write, read, cron, signup, deploy                   |
| [`target-architecture.md`](target-architecture.md)                         | Where we are heading: Vercel Pro (recommended) and an AWS alternative      |
| [`schema/ERD.md`](schema/ERD.md)                                           | Target data model, ER diagrams and the whiteboard mapping                  |
| [`schema/target-schema.sql`](schema/target-schema.sql)                     | Runnable target PostgreSQL schema                                          |
| [`schema/IMPLEMENTATION-PLAN.md`](schema/IMPLEMENTATION-PLAN.md)           | PR-by-PR migration plan (migrations 006–012)                               |
| [`entities.md`](entities.md), [`playground-model.md`](playground-model.md) | Earlier model notes                                                        |

## Conventions

- One topic per page; diagrams live next to the text that explains them.
- Flowcharts for structure, sequence diagrams for flows, `erDiagram` for data.
- Describe what the code does today in "current" pages and label proposals
  clearly in "target" pages.
- Larger decisions can be recorded as short ADRs in `docs/adr/`.

## Regenerating images

```bash
npx -p @mermaid-js/mermaid-cli mmdc -i docs/architecture/data-flows.md \
  -o docs/architecture/images/data-flows.png -b white -s 2
```

`mmdc` writes one PNG per Mermaid block (`data-flows-1.png`, `-2.png`, ...).
