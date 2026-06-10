# Adapters Context

This package owns concrete implementations of application ports. It is where Gravity touches the outside world: filesystem state, persistence, IPC adapters, and provider-backed runtime integration.

## Core Concepts

**Runtime Adapter**:
Gravity's boundary for starting, stopping, and observing a **Run** through an underlying agent runtime.
_Avoid_: UI driver, renderer client, direct SDK dependency

**Pi Adapter**:
The current **Runtime Adapter** implementation backed by `pi`.
_Avoid_: Generic runtime layer, permanent product term

**Runtime Source Event**:
A raw provider event emitted by an underlying runtime before Gravity translates it into product-owned records.
_Avoid_: Activity item, trace event, UI event, canonical runtime event

**Runtime Source Event Metadata**:
The safe provider event type, correlation, timestamp, and reference metadata Gravity keeps for a **Runtime Source Event**.
_Avoid_: Raw payload archive, runtime event, activity stream

## Responsibility

- Implement application contracts without changing application semantics.
- Translate external SDKs, databases, and operating-system concerns into product-owned records and behaviors.
- Keep infrastructure-specific failure modes explicit so the application layer can respond predictably.

## Relationships And Rules

- A **Run** is executed through exactly one **Runtime Adapter**.
- A **Runtime Session** can emit many **Runtime Source Events**.
- A **Runtime Source Event** can produce zero or more **Runtime Events**.
- A **Runtime Source Event** can have **Runtime Source Event Metadata**.
- A **Runtime Event** can reference one **Runtime Source Event**.
- Adapters may preserve provider references for correlation, but must not let provider-native identities become primary product identity.
- Raw provider events are inputs. Gravity-owned runtime events are the durable internal contract.
- Persistence concerns may optimize storage and indexing, but must preserve application-visible ordering and recovery guarantees.
- Filesystem and SDK errors should be translated into stable application-facing failures, warnings, or unavailable states.

## Ambiguities

- **Runtime Source Event** and **Runtime Event** are distinct. Source events are raw provider output; runtime events are Gravity-owned normalized records.
- **Runtime Source Event Metadata** is safe correlation data, not a raw provider payload archive.

## Adapter Areas

- `src/persistence`: SQLite or persistence-backed implementations for runtime state, runs, threads, and projections.
- `src/filesystem`: local filesystem access and project-context attachment support.
- `src/pi`: runtime-provider integration and translation between provider activity and Gravity runtime records.
- `src/ipc`: adapter-side boundaries that support Electron IPC transport.

## What Does Not Belong Here

- New business terminology or lifecycle rules.
- Renderer component state.
- Application orchestration that could be expressed against a port.

## ADR Scope

Use [docs/adr/](/C:/Users/devon/gravity/packages/adapters/docs/adr) for decisions about persistence layout, provider integration boundaries, filesystem rules, and IPC adapter implementation details.

Also read [docs/adr/](/C:/Users/devon/gravity/docs/adr) for ADR discovery and for cross-context decisions that are not owned solely by adapters.
