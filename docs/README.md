# Beside documentation

Start with the [working concept brief](product/concept-brief.md) for the product's current direction, agreed mechanics, provisional reward formula, and open questions. It describes a concept in development; release scope is still undecided.

## Product

- [Original app description](product/app-description.md): the initial brainstorming notes, preserved as written. Some ideas were revised during discussion; use the concept brief for the current direction.
- [Working concept brief](product/concept-brief.md): the consolidated product intent and working decisions.
- [Design principles](product/principles.md): useful, shared, playful, and impactful, preserved from the `docs/entities` branch.
- [Features](product/features.md): an empty placeholder from the initial repository, awaiting dedicated documentation.

## Architecture

- [Shared backend API](../apps/api/README.md): NestJS, Neon/PostgreSQL, Vercel deployment, authentication, OpenAPI, and first-pass limitations.

- [Entity relationship draft](architecture/entities.md): the 2026-10-20 model from `docs/entities`, preserved as written, including open logging-policy questions.
- [Implemented playground model](architecture/playground-model.md): milestones, home-base rewards, milestone-zero participation, schedule policies, and compatibility decisions. These prototype choices differ from parts of the entity draft.
- [Playground model](../apps/playground/README.md): a runnable conceptual experiment with working ownership/participation assumptions, five rendered ERDs, and a [reference SQL shape](../apps/playground/schema.sql). These prototype choices are not final product decisions.

## Design

- [Interaction storyboard](design/storyboard.md): a proposed mobile visit to an established shared space, from discovering a friend's progress to decorating and revisiting keepsakes. Its interface proposals remain exploratory.
- [Mobile UI concept](design/mobile-ui-concept-v1.png): an AI-generated board showing three mobile states, intended to explore visual direction.
- [Image notes](design/image-notes.md): image provenance, intended use, and known limitations. Generated visual details do not establish product requirements.

The [showcase website](../apps/website/README.md) illustrates the concept through local demos. Its world illustration lives with the website's runtime assets.
