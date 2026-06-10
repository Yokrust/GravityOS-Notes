# Application Context

This package owns use cases, orchestration, projections, and policies that coordinate the domain model. It consumes `@gravity/domain` and defines ports that adapters implement.

## Core Concepts

**Stop Run**:
An explicit user action that requests cancellation of an active **Run** through the runtime and preserves partial results after confirmation.
_Avoid_: Fake stop, UI-only cancel, hidden process kill

**Event Catch-Up**:
The backend process of applying committed **Runtime Events** after a known sequence so thread-visible runtime state can recover after missed delivery.
_Avoid_: Replay, Thread Replay, Folder View replay, retrospective playback

**Projector Worker**:
The ordered backend processor that turns committed **Runtime Events** into **Runtime Projections**.
_Avoid_: Runtime adapter, provider session, renderer client

**Thread Snapshot**:
A point-in-time projected view of a **Thread** and its runtime-visible state.
_Avoid_: Runtime event, source event, live stream message

**Live Runtime Stream**:
The ordered delivery of committed **Runtime Events** after a **Thread Snapshot**.
_Avoid_: Raw provider stream, projected snapshot, Thread Replay

**Authentication State**:
Gravity's user-visible view of whether a **Provider** is ready, missing credentials, expired, or needs user action.
_Avoid_: Raw credential payload, provider token format

The canonical definitions of **Runtime Message**, **Runtime Reasoning**, and **Runtime Item** live in `@gravity/domain`. This package defines how those normalized runtime concepts become thread-visible messages, activity, results, and recovery behavior.

## Responsibility

- Turn domain concepts into user-visible workflows.
- Coordinate thread, run, project, replay, and panel state.
- Define contracts for persistence, runtime integration, filesystem access, and IPC-facing application operations.
- Enforce application-layer policies without leaking infrastructure details upward.

## Relationships And Rules

- A **Thread** message belongs to exactly one **Run**.
- A **Run** starts from exactly one user thread message.
- A **Run** can produce one or more assistant thread messages.
- A **Stop Run** action can move an active **Run** to the stopped **Run Status** after runtime confirmation.
- A **Provider** can have one current **Authentication State** in Gravity.
- **Event Catch-Up** reads from the **Runtime Event Log**.
- A **Projector Worker** processes committed **Runtime Events**.
- A **Projector Worker** produces **Runtime Projections**.
- A **Live Runtime Stream** delivers committed **Runtime Events** after a **Thread Snapshot**.
- Projection logic should preserve domain-owned ordering and lifecycle semantics while shaping thread-visible state for the desktop UI.

## Ambiguities

- A tool-use **Runtime Stop Reason** can complete a **Turn** without completing the surrounding **Run**.
- A length **Runtime Stop Reason** fails the **Run** while preserving a partial **Run Result**.
- An aborted **Runtime Stop Reason** stops the **Run**.
- An error **Runtime Stop Reason** fails the **Run**.
- The default **Stop Run Mode** is immediate interruption through runtime abort.
- Stopping after the current **Turn** is a graceful **Stop Run Mode** that preserves the completed turn output.
- **Runtime Reasoning** is projected into activity, not into the final **Run Result**.
- Assistant answer text is projected into thread messages and **Run Result**.
- Agent-backed thread messages require a **Run**.
- The final **Run Result** is based on the final assistant thread message for the **Run**.
- Tool and command output is projected into **Activity Items** unless it is explicitly included in the assistant answer or artifact output.
- Runtime-provided reasoning is projected into **Activity Items**, not thread messages or **Run Result**.
- Runtime context compaction is projected into **Compaction Activity Items**.
- The renderer applies **Live Runtime Stream** events in sequence after loading a **Thread Snapshot**.
- Renderer-side guards ignore duplicate **Runtime Events** and use **Event Catch-Up** when a sequence gap is detected.
- **Event Catch-Up** is reliability plumbing, not the removed Thread Replay or Folder View replay product experience.
- **Projector Worker** is part of Gravity's backend event model, not the runtime provider or renderer.

## Service Areas

- `services/project`: project creation, lookup, and project-scoped workflows.
- `services/run`: execution orchestration and run lifecycle policies.
- `services/thread-panel` and `services/run-panel`: models that shape thread-visible state for the desktop UI.
- `services/replay`: rebuilding or catching up thread-visible state from committed facts.
- `services/auth`: provider readiness and user-action requirements.
- `services/app-workspace`: workspace-level concerns that span contexts.
- `services/editor-surface`, `services/folder-system`, `services/folder-view`, and `services/map`: application behavior for supporting desktop surfaces.
- `contracts` and `dto`: package boundaries and transport-safe shapes.

## Rules

- Application services may compose multiple domain concepts, but must reuse domain terminology rather than redefining it.
- Ports belong here when they express a product need. Implementations belong in adapters.
- Projection logic belongs here when it defines thread-visible behavior.
- UI components should consume application outputs rather than reconstructing orchestration rules locally.

## What Does Not Belong Here

- Electron-only wiring concerns.
- SQLite statements, filesystem traversal, or provider SDK calls.
- New product vocabulary that should instead be defined in `@gravity/domain`.

## ADR Scope

Use [docs/adr/](/C:/Users/devon/gravity/packages/application/docs/adr) for decisions about orchestration boundaries, port design, projection strategies, replay behavior, or application policies.

Read [docs/adr/](/C:/Users/devon/gravity/docs/adr) for ADR discovery and decisions that cross context boundaries without a single package owner.
