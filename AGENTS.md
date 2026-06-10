# AGENTS.md

## Agent skills

### Issue tracker

Issues are managed in Linear, not GitHub. Use the Linear plugin for reads and updates, create issues in the `Gravity` team. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles map to Linear labels: `Triage`, `Info`, `Ready for Agent`, `Human`, and `Skip`. See `docs/agents/triage-labels.md`.

### Domain docs

Treat this repo as multi-context: start from `CONTEXT-MAP.md`, then read relevant `CONTEXT.md` files and ADRs. See `docs/agents/domain.md`.

## Task Completion Requirements

- All of `pnpm format:check`, `pnpm lint`, and `pnpm typecheck` must pass before considering tasks completed.
- Always use `pnpm test`.

## Project Snapshot

Gravity is an Electron application that serves as an agent harness for using AI agents like Codex and Claude.

This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Package Roles

- `packages/domain`: Canonical product language and invariants for projects, threads, runs, runtime sessions, runtime events, and activity. Keep this package side-effect free and infrastructure-free.
- `packages/application`: Use-case orchestration, projections, panel models, replay flows, and application-layer policies. Define ports here and depend only on `@gravity/domain`.
- `packages/adapters`: Concrete implementations of application ports, including persistence, filesystem state, runtime-provider integration, and IPC-facing adapters. Own external SDKs and infrastructure details here.
- `apps/desktop`: Electron main, preload, and renderer surfaces. Compose `@gravity/application` with `@gravity/adapters`, and own desktop wiring, routes, persistence paths, and user-facing workflows.
- `packages/testkit`: Test support package that currently inherits the application and domain contexts; use it for reusable fakes, stubs, and test helpers without introducing production infrastructure concerns.
