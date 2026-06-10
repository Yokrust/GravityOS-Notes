# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT-MAP.md` at the repo root first.
- Read each `CONTEXT.md` relevant to the topic from that map.
- Read the matching local `docs/adr/` directory after the relevant `CONTEXT.md`.

If any of these files don't exist for a given context, proceed silently.

## Repo layout

This repo should be treated as multi-context.

- `CONTEXT-MAP.md` is the entry point.
- `docs/adr/` is the ADR index and future home for cross-context decisions.
- Relevant `CONTEXT.md` files define the language and boundaries for each context.

## Use the glossary's vocabulary

When naming domain concepts in issues, plans, refactors, hypotheses, or tests, prefer the exact terms defined in the relevant `CONTEXT.md`.

## Flag ADR conflicts

If a proposed change conflicts with an ADR, surface that conflict explicitly instead of silently overriding it.
