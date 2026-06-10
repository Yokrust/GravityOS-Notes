# Pi Runtime Event Backend Patterns From T3 Code

This document captures the T3 Code backend patterns Gravity should reference while implementing a Pi-native runtime event backend. It is based on the local T3 checkout used during planning:

- Repository: `https://github.com/pingdotgg/t3code.git`
- Local checkout: `C:\Users\devon\.btca\agent\sandbox\t3code`
- Commit inspected: `d7969264de66dbe0367083af83c19f87162b494c`

Gravity should borrow patterns, not the Codex-specific implementation. T3 is built around Codex app-server and Effect. Gravity is Electron-first and Pi-native, so the useful reference is the backend shape: thread-scoped supervised sessions, canonical runtime events, durable append, ordered ingestion, product projections, Thread Snapshot, Live Runtime Stream, and Event Catch-Up.

## Current Gravity Decisions

These decisions override older planning language:

- Production persistence is metadata-only for raw Pi inputs. Full raw payload capture is opt-in dev diagnostics and fixture capture, not default durable production storage.
- Trace is deprecated. Do not design new first-slice runtime projection work around `Trace`, `TraceEvent`, or `trace.signal`; observability centers on the Agent Activity Stream.
- Runtime Request modeling is deferred. Pi approvals and user-input requests are hooks/policy concerns for now, not first-slice core runtime events.
- Runtime Sessions are thread-scoped and execute many Runs. Runs are not the owner of the session lifecycle.
- Activity Items are Thread-owned and may optionally reference a Run.
- Runtime sequence recovery is called Event Catch-Up, not replay.
- Runtime events need both a global `sequence` and a per-thread `threadSequence`.
- Pi run completion is defined by `agent_end`. The latest `turn_end.message` is the final response source.
- Projection failures are handled per Thread by blocking later projections, retrying with backoff, then exposing degraded projection state.

## 1. Keep The Runtime Transport Boundary Small

Reference:

- `packages/effect-codex-app-server/src/protocol.ts`
- `packages/effect-codex-app-server/src/client.ts`

Good T3 pattern:

- One module owns the runtime communication boundary.
- Inbound messages are decoded once and classified by shape.
- Outbound work that expects a response is tracked in a pending map.
- Process termination settles pending work before shutdown completes.
- Unknown or malformed messages become typed transport/protocol errors.
- Raw and decoded protocol logging can be enabled without leaking protocol concerns into application services.

Gravity application:

- Put Pi SDK/process details behind a `PiSessionSupervisor` or equivalent adapter-owned boundary.
- Do not let `ThreadPanelService`, `RunPanelService`, renderer IPC, or persistence parse raw Pi event shapes.
- Treat Runtime Request support as a later slice. If Pi approval/user-input hooks must be handled before then, keep them as policy hooks inside the supervisor or adapter boundary.
- On session close, process exit, unsubscribe failure, or SDK error, deterministically settle any in-flight supervisor work.
- Persist production raw-event metadata only: provider, Pi event name/type, ids, timestamps, schema/version hints, and correlation refs. Full payloads belong in opt-in diagnostic logs and checked-in fixtures.

Avoid copying:

- T3's JSON-RPC line protocol, Codex method names, request event model, or Effect-specific API shape unless Gravity intentionally adopts those choices.

## 2. Supervise Thread-Scoped Runtime Sessions Explicitly

Reference:

- `apps/server/src/provider/Layers/CodexSessionRuntime.ts`
- `apps/server/src/provider/Layers/CodexAdapter.ts`
- `apps/server/src/provider/Layers/ProviderService.ts`

Good T3 pattern:

- A session runtime owns one provider session lifecycle.
- Session state is explicit and small.
- Stop/close is idempotent.
- Runtime stderr/process-exit signals are converted into runtime warnings/errors instead of crashing downstream projections.
- The adapter emits canonical runtime events through a queue; it does not update product read models directly.
- ProviderService correlates events with the configured provider instance before publishing them to shared subscribers.
- Multiple subscribers get independent streams from a pub/sub source.

Gravity application:

- Make the Pi supervisor the owner of Pi session start, prompt/run execution, subscribe, close, and dispose.
- Scope Runtime Sessions to Threads. A Runtime Session can execute many Runs over time.
- Store session metadata that supports recovery: `sessionId`, `threadId`, `cwd`, `status`, active run id, active Pi turn ids if needed, close/unsubscribe handles, provider refs, and resume cursor if Pi has one.
- Keep `runId` on runtime events and activity projections when an event belongs to a Run, but do not make the session itself run-scoped.
- Make `close()` safe to call more than once and safe after partial startup failure.
- Convert Pi subscription/process failures into canonical `runtime.error`, `runtime.warning`, `session.lost`, or `session.shutdown` events.
- Emit runtime events into a queue or event bus; downstream ingestion owns projections.

## 3. Normalize Into A Gravity-Owned Event Contract

Reference:

- `packages/contracts/src/providerRuntime.ts`
- `apps/server/src/provider/Layers/CodexAdapter.ts`

Good T3 pattern:

- The provider-neutral runtime event union is schema-backed and explicit.
- Provider ids remain available as refs, but application logic reads canonical ids and event types.
- The normalizer can emit zero, one, or many canonical events for one raw provider event.
- Unknown or unrenderable provider events can become warnings or diagnostic-only records without breaking the stream.
- Content streams classify assistant text, reasoning text, command output, and file-change output separately.
- Lifecycle items classify tool calls through a stable canonical item taxonomy instead of raw provider names.

Gravity application:

- Define `GravityRuntimeEvent` in Gravity-owned domain/application contracts before wiring persistence or IPC.
- Keep Pi-specific shape parsing in `packages/adapters`.
- Include raw metadata and provider refs, not full raw payloads, in production canonical events.
- Use full raw Pi payloads only for opt-in dev diagnostic capture and fixture generation.
- Treat malformed Pi events as `runtime.warning` events or diagnostic-only records, not projection exceptions.
- Use tests with captured Pi fixtures to lock down normalization.

Minimum first-slice event families:

- Session: `session.started`, `session.state.changed`, `session.compacted`, `session.shutdown`, `session.lost`
- Run: `run.started`, `run.completed`
- Message: `message.started`, `message.delta`, `message.completed`
- Reasoning: `reasoning.started`, `reasoning.delta`, `reasoning.completed`
- Items/activity: `item.started`, `item.updated`, `item.completed`
- Diagnostics: `runtime.warning`, `runtime.error`

Deferred or excluded from first slice:

- Runtime Requests: `request.opened`, `request.resolved`, approval responses, user-input responses
- Trace: `trace.signal`, `TraceEvent`, trace projection
- Full raw payload persistence in production

## 4. Persist Before Publishing

Reference:

- `apps/server/src/orchestration/Layers/OrchestrationEngine.ts`
- `apps/server/src/persistence/Services/OrchestrationEventStore.ts`
- `apps/server/src/persistence/Layers/OrchestrationEventStore.ts`
- `apps/server/src/persistence/Migrations/001_OrchestrationEvents.ts`

Good T3 pattern:

- Storage assigns a monotonic `sequence`.
- `event_id` is unique.
- Event append and projection happen before live publication.
- Live publication happens only after commit.
- Catch-up reads events in ascending sequence order, using bounded pages.
- Read models can reconcile from persisted events after dispatch failure.

Gravity application:

- Add a narrow `runtime_events` table before considering a full orchestration event store.
- Assign both a global `sequence` and a per-thread `threadSequence`.
- Add a unique `event_id` for idempotency.
- Store canonical event JSON plus production-safe raw metadata, not the full raw Pi payload.
- Publish committed runtime events to IPC only after SQLite append succeeds.
- Query global catch-up with `WHERE sequence > ? ORDER BY sequence ASC LIMIT ?`.
- Query thread catch-up with `WHERE thread_id = ? AND thread_sequence > ? ORDER BY thread_sequence ASC LIMIT ?`.
- Keep indexes for global sequence, `(thread_id, thread_sequence)`, and optional `(run_id, sequence)`.

Suggested durable rules:

- Duplicate `eventId` is a no-op or returns the existing row.
- JSON decode errors are typed persistence errors.
- Event Catch-Up limits are clamped.
- Projections never see an event that has not been committed.
- Dev-only raw payload logs must be explicitly enabled and kept out of normal production persistence.

## 5. Process Runtime Events Through An Ordered Worker

Reference:

- `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`
- `@t3tools/shared/DrainableWorker`

Good T3 pattern:

- Provider runtime events are not projected inline inside the provider adapter.
- A single ingestion service consumes canonical runtime events.
- A drainable worker serializes processing so deltas, completions, and lifecycle changes apply in order.
- Assistant deltas are buffered when needed and flushed on durable lifecycle boundaries.
- Ingestion keeps short-lived state caches keyed by thread/turn/message with TTLs to prevent unbounded memory growth.
- Lifecycle guards prevent stale turn events from closing or reopening the wrong active turn.

Gravity application:

- Implement `RuntimeEventIngestionService` in `packages/application`.
- Feed it committed `GravityRuntimeEvent` records in per-thread `threadSequence` order.
- Project to `ThreadMessage`, Thread-owned `AgentActivityItem`, `Run`, and `RunResult` from one place.
- Do not project to Trace.
- Make every projection idempotent. Event Catch-Up should not duplicate messages, activity items, runs, or run results.
- Buffer assistant and reasoning deltas by thread/session/run/message/item id, with a maximum buffered character limit.
- Use Pi boundaries for completion: `agent_end` completes the Run, and the latest `turn_end.message` supplies the final response content.
- On projection failure, block later projections for that Thread, retry with backoff, and expose degraded projection state if retries are exhausted.

Lifecycle guard examples:

- A stale Pi turn completion for turn A must not mark run B as completed.
- A `runtime.error` without matching active run context should not overwrite a newer successful run.
- `session.shutdown` can clear active session state while preserving partial output and existing activity.
- `session.lost` should make recovery state explicit without pretending the Run completed.
- A missing tool completion should leave an in-progress Activity Item visible or be finalized by session shutdown/lost policy.

## 6. Convert Runtime Events Into Product Projections Deliberately

Reference:

- `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`
- `runtimeEventToActivities` in `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`
- `packages/contracts/src/orchestration.ts`

Good T3 pattern:

- Runtime events are translated into product commands/events, not directly into renderer state.
- Assistant text, activity items, session state, warnings/errors, and tool lifecycle events each have explicit projection rules.
- Activity records keep sequence information when available, which makes UI ordering stable.
- Runtime errors become activity rows and session state changes.

Gravity application:

- Keep the product vocabulary authoritative: `Thread`, `Run`, `Agent Activity Stream`, and `Run Result`.
- Treat Activity Items as Thread-owned records with optional Run references.
- Do not collapse all runtime data into chat transcript messages.
- Use `message.*` events for assistant messages, `reasoning.*` events for reasoning display/activity, and `item.*` events for tool/activity lifecycle.
- Attach both `sequence` and `threadSequence` to Activity Items where possible.
- Keep canonical event storage separate from the renderer-facing read model.
- Leave Runtime Request projection for a dedicated later slice.

## 7. Use Thread Snapshot, Live Runtime Stream, And Event Catch-Up

Reference:

- `packages/contracts/src/orchestration.ts`
- `packages/contracts/src/rpc.ts`
- `apps/server/src/ws.ts`

Good T3 pattern:

- Subscription contracts are typed.
- A subscription emits an initial snapshot first, then live events.
- Snapshots include the sequence at which they were read.
- Clients can ask for events after a sequence.
- Live thread streams filter to thread-detail events.
- Catch-up and live subscription share the same event shape.

Gravity application:

- Mirror this over Electron IPC rather than WebSocket.
- Provide `getThreadSnapshot(threadId)` with `lastRuntimeSequence` and `lastThreadRuntimeSequence`.
- Provide `catchUpThreadEvents({ threadId, afterThreadSequence })`.
- Provide `subscribeThreadRuntime({ threadId, afterThreadSequence })`.
- Renderer state should track the last applied `threadSequence` per Thread and be disposable.
- On reload/reconnect, load a Thread Snapshot and perform Event Catch-Up from the snapshot sequence or last applied renderer sequence, depending on the chosen contract.
- Never require the renderer to subscribe before the runtime starts in order to see complete state.

## 8. Make Commands And User Actions Idempotent

Reference:

- `apps/server/src/orchestration/Layers/OrchestrationEngine.ts`
- `apps/server/src/persistence/Migrations/002_OrchestrationCommandReceipts.ts`
- `apps/server/src/persistence/Layers/OrchestrationCommandReceipts.ts`

Good T3 pattern:

- Commands carry command ids.
- Accepted/rejected command receipts prevent duplicate work on retries.
- Repeated commands return the accepted result sequence instead of running again.
- Rejected commands preserve the reason.

Gravity application:

- Add idempotency keys to first-slice user actions that can be retried, especially start run and stop/shutdown session.
- Store command receipt or equivalent result sequence for runtime-affecting commands when retries become possible.
- Return the committed runtime `sequence` and `threadSequence` to the caller so the renderer can reconcile.
- Leave approval/user-input response idempotency to the deferred Runtime Request slice.

## 9. Keep Provider Recovery State Persisted

Reference:

- `apps/server/src/provider/Layers/ProviderService.ts`
- `apps/server/src/persistence/Services/ProviderSessionRuntime.ts`

Good T3 pattern:

- Provider session bindings are persisted by thread.
- Bindings include provider, provider instance, status, runtime mode, resume cursor, and runtime payload.
- Session recovery first adopts an existing active session, then uses persisted resume cursor if available.
- Stop-all persists stopped state before tearing down adapters.
- Stale sessions for other provider instances are stopped when a new session starts for the same thread.

Gravity application:

- Persist Pi session binding state separately from transient in-memory session handles.
- Persist bindings by Thread, not by Run.
- If Pi supports resume, store the resume cursor/session id with the Thread-scoped Runtime Session.
- If Pi does not support resume, persist enough state to mark in-progress Runs stopped/degraded after app restart.
- On app restart, reconcile persisted in-progress Runs and lost sessions before accepting new Runs.
- Preserve partial assistant output and canonical event history even when recovery cannot resume the Pi process.

## 10. Test The Spine With Fixtures And Event Catch-Up

Reference:

- `packages/contracts/src/providerRuntime.test.ts`
- `apps/server/src/persistence/Layers/OrchestrationEventStore.test.ts`
- `apps/server/src/orchestration/decider*.test.ts`
- `apps/server/src/server.test.ts`

Good T3 pattern:

- Contracts have decode/compatibility tests.
- Persistence tests verify append, sequence assignment, and catch-up reads.
- Stream tests assert snapshot-first streams and catch-up behavior.
- Ingestion/projection behavior is tested with event sequences.

Gravity application:

- Capture representative Pi raw events as dev fixtures, not as default production durable payloads.
- Unit test `PiRuntimeEventNormalizer` against those fixtures.
- Test event store duplicate `eventId`, global `sequence`, per-thread `threadSequence`, thread Event Catch-Up, and malformed canonical JSON handling.
- Test ingestion sequences for message deltas, reasoning deltas, tool start/end, runtime error, duplicate events, stale turn completions, `agent_end`, and latest `turn_end.message`.
- Test IPC subscription with Thread Snapshot first and Event Catch-Up after sequence semantics.
- Test per-Thread projection blocking, retry with backoff, and degraded projection state.

## Useful T3 Snippets To Extract

Extract these as reference snippets when implementation begins:

- `packages/effect-codex-app-server/src/protocol.ts`: pending request map, `failAllPending`, termination handling, and inbound message classification. Use as a cleanup reference, not as Pi protocol design.
- `packages/effect-codex-app-server/src/client.ts`: typed known-handler plus unknown-handler registration. Useful later if Gravity models Runtime Requests.
- `packages/contracts/src/providerRuntime.ts`: discriminated event-union structure, base event shape, provider refs, and schema-backed payload organization. Do not copy raw payload fields, request events, trace concepts, or the huge event surface.
- `apps/server/src/persistence/Layers/OrchestrationEventStore.ts`: append-and-return-row SQL, unique event id concept, decode-after-read pattern, and paginated `readFromSequence`. Adapt to global `sequence` plus per-thread `threadSequence`.
- `apps/server/src/ws.ts`: `subscribeThread` snapshot-first then filtered live stream pattern. Rename and adapt to Thread Snapshot, Live Runtime Stream, and Event Catch-Up.
- `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`: stale turn protection, active turn checks, bounded caches, and assistant delta buffering. Do not copy request, Trace, or proposed-plan specifics.
- `runtimeEventToActivities` in `ProviderRuntimeIngestion.ts`: mapping style for runtime warning/error/tool/compaction-like events into activity records. Adapt to Thread-owned Activity Items with optional Run refs.
- `makeDrainableWorker` usage in `ProviderRuntimeIngestion.ts`: ordered worker pattern. Adapt failure behavior to block/retry/degraded per Thread.
- `isThreadDetailEvent` and live stream filtering in `apps/server/src/ws.ts`: filtering committed events to thread-detail streams.
- Event id and command id helper patterns such as `providerCommandId`: useful for idempotency and correlation, but not first-slice critical unless command receipts are added.

## Implementation Checklist

Use this checklist when building the Pi runtime backend:

- Production runtime event persistence stores canonical events plus raw metadata only.
- Full raw Pi payload capture is opt-in dev diagnostics or fixture capture.
- Pi event parsing lives in adapters, not application services or renderer code.
- Canonical runtime events are Gravity-owned and schema/type checked.
- Canonical events include provider refs and production-safe raw metadata.
- Runtime events are appended to SQLite before IPC publication.
- Every committed runtime event has a global `sequence` and a per-thread `threadSequence`.
- Runtime event ingestion is ordered, idempotent, and isolated from provider callbacks.
- Per-Thread projection failures block later projection, retry with backoff, then expose degraded state.
- Projections update messages, Thread-owned Activity Items, Runs, and Run Results from canonical events only.
- Trace is not part of the first-slice runtime event projection.
- Runtime Requests are deferred from the first slice.
- Thread Snapshot, Live Runtime Stream, and Event Catch-Up use the same runtime event cursor semantics.
- Session close and process failure settle in-flight supervisor work and preserve partial output.
- Run completion uses Pi `agent_end`; final response content comes from the latest `turn_end.message`.
- Recovery policy is explicit for in-progress Runs and lost Runtime Sessions after app restart.

## Anti-Patterns To Avoid

- Direct callbacks from `PiRuntimeAdapter` into thread/run persistence.
- Renderer-side Pi event interpretation.
- Product logic depending on raw Pi event names.
- Durable production persistence of full raw Pi payloads by default.
- Publishing live events before persistence succeeds.
- Treating assistant deltas as the only runtime data worth preserving.
- Crashing or silently skipping later projections after a per-Thread projection failure.
- Using only timestamps or array indexes instead of persisted `sequence` and `threadSequence`.
- Letting stale turn/session events overwrite newer active Run state.
- Reintroducing Trace or Runtime Requests into the first runtime event slice.
- Calling Event Catch-Up "replay" in runtime APIs or docs.
- Building a full T3-style orchestration engine before Gravity has a narrow reliable runtime event store.
