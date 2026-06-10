# Domain Context

Gravity's Agent Harness is the primary interaction domain for continuity, project attachment, execution, and runtime-visible activity. It defines how users talk to the agent, how **Projects**, **Threads**, and **Runs** relate, and what continuity persists across turns.

This package owns the canonical language and structural invariants for Gravity's agent harness model. If a term names a product concept, this is the source of truth unless a narrower context explicitly extends it.

## Core Concepts

### Attachment And Continuity

**Project**:
A long-lived container for related work and history, with local folders serving as one important attached working context.
_Avoid_: Folder system, workspace, repo clone, mere folder selection

**Project Context Attachment**:
The local folder attachment required at project creation that makes a **Project** executable with its expected working context.
_Avoid_: Project identity, thread, run history

**Executable Project**:
A **Project** whose **Project Context Attachment** is available and therefore ready for new **Runs**.
_Avoid_: Historical project, detached project, broken app

**Unavailable Project Context**:
The state where a **Project** still exists historically but cannot start new **Runs** because its **Project Context Attachment** is missing or no longer reachable.
_Avoid_: Deleted project, broken app, erased history

**Reattach Project Context**:
The action that restores or replaces a missing **Project Context Attachment** so the **Project** can become executable again.
_Avoid_: Restore thread, replay, silent repair

**Thread**:
A user-facing continuity object that preserves back-and-forth interaction with an agent across turns.
_Avoid_: Run, single message, transcript fragment

**Chat Thread**:
A **Thread** without project attachment that behaves like a general chat surface and therefore lacks default project-scoped access, permissions, and working context.
_Avoid_: Conversation thread, project thread, detached run, implicit project memory

**Project Thread**:
A **Thread** permanently attached to exactly one **Project** and giving the agent default access, permissions, and working context for that project.
_Avoid_: Conversation thread, movable thread, multi-project thread

**Granted Access**:
Explicit user-approved access that lets the agent work beyond a **Thread**'s default working context.
_Avoid_: Primary attachment, implicit scope, permanent global permission

**Turn**:
A runtime conversation step within a **Run**.
_Avoid_: Run, thread, runtime session, full task

### Execution And Runtime

**Runtime Stop Reason**:
The provider-derived reason a **Turn** or **Run** stopped producing output.
_Avoid_: Run status, user-facing result, event type

**Runtime Message**:
An assistant message lifecycle inside a **Turn**.
_Avoid_: Thread message, run result, raw provider message

**Runtime Reasoning**:
Runtime-provided reasoning content that Gravity is allowed to surface as activity rather than final answer text.
_Avoid_: Run result, thread message, hidden thoughts

**Runtime Item**:
A normalized tool or command lifecycle inside a **Turn**.
_Avoid_: Activity item, trace event, provider tool payload

**Run**:
A bounded execution attempt by the agent inside a **Thread**. A **Run** captures execution, activity, and result.
_Avoid_: Session, chat, conversation, primary orchestration container

**Run Result**:
The final response, outputs, artifacts, and status produced by a **Run**.
_Avoid_: Trace, transcript, activity stream

**Run Status**:
The completion state of a **Run**, such as completed, failed, or stopped.
_Avoid_: UI badge, trace state, provider state

**Stop Run Mode**:
The runtime stop strategy for an active **Run**, either immediate interruption or stopping after the current **Turn**.
_Avoid_: Run status, session shutdown, delete thread

**Active Run Limit**:
The execution safety rule that controls how many **Runs** may be in progress for a shared working context.
_Avoid_: Scheduler, project status, thread type

**Actor**:
The agent or execution participant responsible for some portion of a **Run**'s activity.
_Avoid_: User, folder node, project role

**Runtime Session**:
The long-lived runtime-managed execution instance underlying a **Thread**'s runtime continuity.
_Avoid_: Run, thread, chat message

**Runtime Session Status**:
Gravity's lifecycle state for a **Runtime Session**, such as starting, idle, running, waiting, compacting, shutdown, lost, or error.
_Avoid_: Run status, provider event name, activity status

**Runtime Session Record**:
Gravity's persisted record of a **Runtime Session** and its provider resume metadata.
_Avoid_: Run, provider session object, event log

**Lost Runtime Session**:
A prior **Runtime Session** that Gravity can no longer resume or observe after interruption.
_Avoid_: Failed run, deleted thread, broken history

**Runtime Session Shutdown**:
A graceful provider-observed end of a **Runtime Session**.
_Avoid_: Lost runtime session, failed run, app crash

**Runtime Session Compaction**:
A provider-observed context compaction inside a long-lived **Runtime Session**.
_Avoid_: Run completion, message summary, lost session

**Runtime Event**:
A Gravity-owned, normalized event derived from a runtime source event and persisted before projection into product-owned records.
_Avoid_: Trace event, activity item, UI event, raw provider payload

**Runtime Event Type**:
The Gravity-owned category of a **Runtime Event**, such as session, run, turn, message, reasoning, item, trace, warning, or error.
_Avoid_: Provider event name, UI action, projection kind

**Runtime Warning**:
A non-fatal runtime backend issue that Gravity surfaces without ending the active **Run**.
_Avoid_: Run failure, hidden log, provider event name

**Runtime Error**:
A runtime backend issue that prevents Gravity from preserving correct execution lifecycle.
_Avoid_: Warning, hidden log, provider event name

**Runtime Event Log**:
The durable ordered record of **Runtime Events** used to catch up, rebuild, project, and resume thread-visible runtime state.
_Avoid_: Transcript, activity stream, trace, provider log

**Provider Reference**:
A provider-native identifier or metadata value preserved on a Gravity-owned runtime record for correlation and debugging.
_Avoid_: Primary Gravity identity, sequence, product id

**Runtime Projection**:
A product-owned record derived from **Runtime Events**, such as a **Thread** message, **Activity Item**, **Run**, or **Run Result**.
_Avoid_: Source event, runtime event, provider payload

**Provider**:
The model or vendor account source the runtime uses to authenticate and execute a **Run**.
_Avoid_: Run, actor, runtime adapter

### Thread Surface Activity

**Agent Activity Stream**:
A runtime-provided stream of agent activity during a **Thread**, including tool calls, command output, runtime status, assistant messages, and any runtime-provided reasoning traces Gravity is allowed to surface.
_Avoid_: Trace, run result, hidden thoughts

**Activity Item**:
One ordered entry in the **Agent Activity Stream**.
_Avoid_: Trace event, replay step, transcript line

**Warning Activity Item**:
A non-fatal runtime or normalization issue surfaced in the **Agent Activity Stream**.
_Avoid_: Run failure, hidden log, provider exception

**Error Activity Item**:
A runtime or execution failure surfaced in the **Agent Activity Stream**.
_Avoid_: Run result, hidden log, warning

**Compaction Activity Item**:
A visible **Agent Activity Stream** entry that records runtime context compaction.
_Avoid_: Hidden lifecycle event, warning, run result

**Trace**:
Gravity's deprecated curated per-**Run** record of confirmed project-shaped behavior, scheduled for removal after Folder View and Thread Replay removal.
_Avoid_: Primary observability model, activity stream, run result

## Relationships And Rules

- A **Thread** can be either a **Chat Thread** or a **Project Thread**.
- A **Chat Thread** can exist without a **Project**.
- A **Chat Thread** can still use Gravity's harness capabilities without default project grounding.
- A **Project** is created only through an initial **Project Context Attachment**.
- A **Project Thread** belongs to exactly one **Project**.
- A **Project Thread** cannot be moved to a different **Project** after creation.
- A **Project Thread** remains part of its **Project**'s ongoing history unless it becomes a trashed thread in the desktop surface.
- A **Project Thread** gives the agent default access, permissions, and working context for its attached **Project**.
- A **Chat Thread** can gain additional resource scope through **Granted Access**.
- A **Project Thread** may still allow work outside its attached **Project** through **Granted Access**.
- A **Project** becomes an **Executable Project** only when it has an available **Project Context Attachment**.
- A **Project** can enter **Unavailable Project Context** without losing its history.
- A **Project** in **Unavailable Project Context** cannot start new **Runs**.
- A **Project** in **Unavailable Project Context** remains browsable for thread and run history.
- **Reattach Project Context** can return a **Project** to **Executable Project**.
- A **Run** can contain one or more **Turns**.
- A **Turn** belongs to exactly one **Run**.
- A **Turn** can have one **Runtime Stop Reason**.
- A **Run** can have one final **Runtime Stop Reason**.
- A **Turn** can contain many **Runtime Messages**.
- A **Runtime Message** can contain many content deltas.
- A **Turn** can contain many **Runtime Reasoning** segments.
- **Runtime Reasoning** can contain many reasoning deltas.
- A **Turn** can contain many **Runtime Items**.
- A **Runtime Item** can produce zero or more **Activity Items**.
- An **Activity Item** belongs to one **Thread**.
- An **Activity Item** can reference zero or one **Run**.
- A **Chat Thread** can contain many **Runs**.
- A **Project Thread** can contain many **Runs**.
- A **Project Thread** can exist before its first **Run**.
- A **Run** belongs to exactly one **Thread**.
- A **Run** can belong to zero or one **Project**.
- A **Run** is the recorded execution unit for agent work, not the top-level continuity container for the user interaction.
- A **Run** starts when the agent enters a bounded execution episode that Gravity should track as work.
- Sending work into a **Runtime Session** implies creating a **Run**, including in a **Chat Thread**.
- A **Run** completes when the runtime call for the submitted work resolves, rejects, or is stopped.
- A **Project** can have at most one active **Run** across its **Project Threads** under the current **Active Run Limit**.
- A **Chat Thread** can have at most one active **Run** under the current **Active Run Limit**.
- Multiple **Chat Threads** can have active **Runs** at the same time under the current **Active Run Limit**.
- A **Thread** can have zero or one active **Runtime Session**.
- A **Runtime Session** belongs to exactly one **Thread**.
- A **Runtime Session** can execute many **Runs** over time.
- A **Runtime Session** has one current **Runtime Session Status**.
- A **Runtime Session** has one **Runtime Session Record**.
- A **Runtime Session Record** can carry zero or more **Provider References**.
- A **Runtime Session** can become a **Lost Runtime Session** after app restart or runtime interruption.
- A **Runtime Session** can have one **Runtime Session Shutdown**.
- A **Runtime Session** can have many **Runtime Session Compactions**.
- A **Run** executes within one **Runtime Session**.
- A **Run** produces one **Run Result**.
- A **Run** should not create new **Trace** records.
- A **Run** can reference one **Provider**.
- A **Run** has one **Run Status**.
- A **Run** can involve one or more **Actors**.
- A **Runtime Event** has one **Runtime Event Type**.
- A **Runtime Event Log** contains many ordered **Runtime Events**.
- A **Runtime Event** has a Gravity-owned identity and can carry zero or more **Provider References**.
- A **Runtime Event** can produce zero or more **Runtime Projections**.
- A **Thread** can surface an **Agent Activity Stream** during **Runs**.
- An **Agent Activity Stream** can contain many ordered **Activity Items**.
- An **Agent Activity Stream** can contain **Warning Activity Items** and **Error Activity Items**.
- An **Agent Activity Stream** can contain **Compaction Activity Items**.
- **Trace** code and persistence should be removed in a dedicated vertical slice.

## Worked Examples

> **Dev:** "If the user attaches a project, do we create a new thread for that?"
> **Domain expert:** "No. A **Chat Thread** upgrades in place into a **Project Thread** through the **Project Transfer Control**."
>
> **Dev:** "If the user asks the agent to research the web in a **Chat Thread**, is that still a **Run**?"
> **Domain expert:** "Yes. A **Run** is a bounded execution attempt, even when no project is attached and no **Trace** will exist."
>
> **Dev:** "If the user deletes a **Project Thread**, is it gone immediately?"
> **Domain expert:** "No. It becomes a trashed thread in the **Trash Bin** and stays restorable for 30 days."
>
> **Dev:** "If that thread is restored while its project has missing folder context, does restore repair the project too?"
> **Domain expert:** "No. The **Project Thread** returns to its original **Project** as browsable history, but the project stays in **Unavailable Project Context** until reattachment."
>
> **Dev:** "If the attached folder disappears, does the **Project** break?"
> **Domain expert:** "No. The **Project** remains as history, but it enters **Unavailable Project Context** and cannot start new **Runs** until the user uses **Reattach Project Context**."
>
> **Dev:** "What can the user still do while a **Project** is in **Unavailable Project Context**?"
> **Domain expert:** "They can still browse project history, but new run controls stay blocked until the project context is reattached."
>
> **Dev:** "Can a **Chat Thread** still use tools or MCPs without a project?"
> **Domain expert:** "Yes. Both thread types can use Gravity's harness capabilities, but only a **Project Thread** begins with default project grounding."
>
> **Dev:** "Where does the user watch active work happen?"
> **Domain expert:** "In the **Thread Panel**, through the **Agent Activity Stream** and eventual **Run Result**."

## Ambiguities

- **Thread** and **Run** are distinct. A **Thread** is the continuity container; a **Run** is one bounded execution attempt within that continuity.
- **Chat Thread** and **Project Thread** are distinct thread types. The boundary is project attachment, not whether useful discussion can happen.
- **Chat Thread** and **Project Thread** are the only canonical **Thread** types in Gravity's domain model.
- **Chat** is the presentation label for the detached **Thread** type, not a second parent continuity concept.
- Both **Chat Threads** and **Project Threads** can use Gravity's harness capabilities, but only **Project Threads** begin with default project grounding.
- **Project** is the only primary user-owned working context term. **Folder System** is retired and should not compete with it in product or domain language.
- A detached work flow belongs in a **Chat Thread**, not in a partially created **Project** without context attachment.
- A **Project** can remain valid historically without being executable. History persists, but new **Runs** require an available **Project Context Attachment**.
- A **Project** persists as a durable container even when its folder attachment is missing, but execution readiness depends on an available **Project Context Attachment**.
- **Unavailable Project Context** blocks new execution, but it does not hide or destroy project history.
- Reattaching a different folder restores executability but may not restore the same working context as the original attachment.
- Project attachment is one-way. A **Project Thread** does not downgrade back into a **Chat Thread**.
- **Granted Access** extends a thread's working scope explicitly; it does not replace the difference between detached chat behavior and default project grounding.
- **Run** and **Turn** are distinct. A **Run** is Gravity's bounded execution record; a **Turn** is a runtime conversation step inside that execution.
- **Runtime Message** and thread message are distinct. A **Runtime Message** is normalized event input; a thread message is a projected thread record.
- **Runtime Item** and **Activity Item** are distinct. A **Runtime Item** is normalized event input; an **Activity Item** is a projected stream record.
- **Agent Activity Stream** is Gravity's primary user-facing observability model for runtime behavior.
- **Activity Items** are thread-owned records and may reference a **Run** when the activity occurs during one.
- **Trace** is deprecated after Folder View and Thread Replay removal and should not drive new runtime backend design.
- **Runtime Event** and **Runtime Projection** are distinct. Runtime events are the durable ordered input; projections are product-owned read records derived from them.
- **Runtime Event Types** are Gravity-owned and do not mirror every provider event name.
- **Provider References** are not primary Gravity identities. They exist to correlate Gravity-owned records with provider-native runtime data.
- A **Lost Runtime Session** does not invalidate **Thread** continuity or previously persisted **Runs**.
- **Runtime Session Shutdown** and **Lost Runtime Session** are distinct. Shutdown is graceful and provider-observed; lost means Gravity cannot observe or resume the prior session.
- **Runtime Session Compaction** is a session lifecycle event, not a **Run** or **Turn** completion.
- **Runtime Session Compaction** temporarily overrides **Runtime Session Status** and restores the prior non-compacting status unless shutdown, lost, or error occurs.
- Idle **Runtime Session Status** means the session is alive and ready for work but no **Run** is active.
- A terminal **Runtime Session Status** prevents new work from being sent into that **Runtime Session**.
- A **Lost Runtime Session** stops any active **Run** with partial output preserved.
- A session-level error during active work fails the active **Run**.
- **Runtime Session Shutdown** without clear run completion evidence stops any active **Run** with partial output preserved.
- An in-progress **Run** whose **Runtime Session** is lost is stopped with partial output preserved.
- A **Run** does not require a **Project** or a **Trace**. New runs should persist activity and results without creating trace history.
- The current **Active Run Limit** is intentionally conservative and may be revisited when Gravity has a safe project-level concurrency model.

## Package Ownership

- `src/run`: run lifecycle concepts and identities.
- `src/trace`: legacy trace concepts that are being removed in favor of runtime events and activity.
- `src/folder-system` and `src/map`: shared domain structures used by the desktop experience.
- `src/shared`: cross-cutting domain primitives.

## What Does Not Belong Here

- Electron process wiring.
- Renderer-specific state or component concerns.
- SDK-specific runtime logic.
- Persistence schema details that do not change the product model.

## ADR Scope

Use [docs/adr/](/C:/Users/devon/gravity/packages/domain/docs/adr) for domain-specific decisions that change terminology, invariants, identities, lifecycle rules, or ordering semantics.

Use [docs/adr/](/C:/Users/devon/gravity/docs/adr) only as the ADR index and for cross-context decisions that cannot be owned solely by the domain context.
