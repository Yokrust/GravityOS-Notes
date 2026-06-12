# Desktop Context

This app owns the Electron shell and the user-facing surfaces that expose Gravity's application model.

## Core Concepts

### Thread Navigation

**Project Transfer Control**:
A prompt-adjacent control in the **Thread Panel** that upgrades an idle **Chat Thread** into a **Project Thread** by selecting or creating a **Project**.
_Avoid_: Hidden handoff, automatic upgrade, project switcher

**Chats Header**:
The always-visible navigation section that lists **Chat Threads**.
_Avoid_: Collapsible sidebar group, project container, active thread

**Projects Header**:
The always-visible navigation section that lists **Project Groups**.
_Avoid_: Collapsible sidebar group, thread row, project switcher

**Project Group**:
An expandable navigation container for one **Project** and its **Project Threads**.
_Avoid_: Thread, active selection, folder node

**Active Thread Highlight**:
The navigation highlight applied only to the currently rendered **Thread**.
_Avoid_: Project selection, hover style, group highlight

**Trash Bin**:
A recovery container that holds deleted threads for up to 30 days before permanent deletion.
_Avoid_: Archive, permanent delete, project history

**Trashed Thread**:
A deleted **Chat Thread** or **Project Thread** that remains restorable while it is in the **Trash Bin**.
_Avoid_: Active thread, archived thread, permanently deleted thread

**Restore Thread**:
The action that returns a **Trashed Thread** to its prior location and continuity.
_Avoid_: Duplicate thread, import, replay

**Empty Trash**:
The action that permanently deletes all **Trashed Threads** currently in the **Trash Bin**.
_Avoid_: Restore, hide, archive

### Thread Surface Activity

**Thread Panel**:
The primary surface where the user starts and continues a **Thread**, sees the **Agent Activity Stream**, and receives **Run Results**.
_Avoid_: project canvas, hidden runtime log

### Satellite Model

**Satellite**:
A small, self-contained productivity widget the user can summon as a floating overlay inside Gravity to perform a focused task without leaving the app or opening a separate window. Independent of any folder system or run. Quick Note allows multiple simultaneous floating windows; Pomodoro and Calendar are limited to a single floating window at a time. Closing a satellite window hides its UI but does not necessarily stop the satellite.
_Avoid_: Agent, folder node, trace overlay, separate Electron window, full application, always-on-top pinning

**Satellite Type**:
A kind of satellite available in Gravity. Built-in types such as Quick Note, Calendar, and Pomodoro have Gravity-owned behavior; a Custom Satellite Type is user-defined and has a generated field schema.
_Avoid_: Satellite Instance, third-party plugin

**Custom Satellite Type**:
A user-defined Satellite Type with a persisted name, appearance, and field schema. One type can have multiple Custom Satellite Instances.
_Avoid_: Built-in Satellite Type, Satellite Instance, temporary template

**Custom Satellite Instance**:
A persisted occurrence of a Custom Satellite Type with its own field values, visibility, position, size, and stack order.
_Avoid_: Custom Satellite Type, transient window, built-in Satellite

**Note**:
A persisted rich-text entry managed by the Quick Note satellite. Each **Note** has a user-editable title, rich-text content, and the moments it was created, last edited, and last opened.
_Avoid_: File on disk, AGENTS.md, sidebar entry, ephemeral sticky

**Current Note**:
The **Note** loaded into a Quick Note satellite for editing. Switching to another note changes the current note. There is no current note when the satellite is closed.
_Avoid_: Pinned note, last edited globally, persisted selection

**Pomodoro Phase**:
The interval the Pomodoro is currently in: focus, short break, or long break.
_Avoid_: User-configurable interval, generic countdown step

**Pomodoro Cycle**:
One completed focus phase.
_Avoid_: Full focus-plus-break round, calendar day session

**Pomodoro Run State**:
Whether the Pomodoro is currently idle, running, or paused. Closing the satellite window does not change the run state.
_Avoid_: Window visibility, satellite open/closed flag

**Pomodoro Counters**:
The lifetime tallies the Pomodoro keeps across satellite open/close and Gravity restarts: total completed cycles and total breaks taken.
_Avoid_: Per-day stats, focus-time dashboard, calendar history

**Pomodoro Reset**:
An explicit user action that stops the active Pomodoro phase and returns the satellite to idle. It does not clear the lifetime counters.
_Avoid_: Wipe stats, daily rollover, undo

**Reminder**:
A scheduled notification the user creates inside the Calendar satellite. Each **Reminder** has a title, a date, and a time. When that moment arrives, the reminder fires a toast notification with sound.
_Avoid_: Calendar event with duration, blocking time slot, multi-alarm event

**Reminder Recurrence**:
A simple repeat rule attached to a **Reminder**: none, daily, or weekly.
_Avoid_: Per-firing edit, calendar exception, full recurrence-rule expression

**Calendar Month View**:
The primary surface inside the Calendar satellite. It shows the days of one month with a visible mark on each day that has at least one **Reminder**.
_Avoid_: Day-detail view, weekly grid, agenda list

**Hub Activity Indicator**:
A visual signal on the **Satellite Hub** button in the top bar showing whether each satellite type has live background activity.
_Avoid_: Unread badge, notification count, persistent error light

**Satellite Hub**:
The top-bar menu in Gravity that lists every **Satellite Type** and acts as the drag source for placing a satellite onto the screen.
_Avoid_: Sidebar, separate panel, settings dialog

**Satellite State**:
The persisted, type-specific data Gravity stores for a satellite between sessions. Custom Satellite State includes field values, visibility, position, size, and stack order.
_Avoid_: Ephemeral hover state, temporary drag state

**App Surface**:
One of Gravity's primary full-window surfaces selected from the top bar — **Notes**, **Threads**, or **Settings**. Notes and Threads are content surfaces; **Settings** is a temporary surface layered over whichever content surface was active and returns to it when dismissed.
_Avoid_: Modal dialog, route history stack, multi-pane split

## Responsibility

- Wire application services and adapters into the Electron main process.
- Expose safe capabilities through preload and IPC.
- Render thread, activity, folder, and related surfaces in the renderer.
- Preserve predictable behavior during long-running runs, reconnects, partial streams, and restarts.

## Relationships And Rules

- A **Chat Thread** can be upgraded in place into a **Project Thread** through the **Project Transfer Control**.
- A **Chat Thread** renders under the **Chats Header**.
- A deleted **Chat Thread** can become a **Trashed Thread**.
- A **Project Thread** renders inside its owning **Project Group**.
- A **Trashed Thread** carries its runs and their associated activity, results, and traces as one recoverable unit.
- A **Run** is hidden from active history when its owning **Thread** becomes a **Trashed Thread**.
- A **Projects Header** can contain many **Project Groups**.
- A **Project Group** belongs to exactly one **Project**.
- A **Project Group** can contain many **Project Threads**.
- A **Project Group** never carries the **Active Thread Highlight**.
- A **Trash Bin** can contain many **Trashed Threads**.
- A **Trashed Thread** remains restorable for up to 30 days.
- A **Restore Thread** returns a **Trashed Thread** to its prior thread location.
- A restored **Project Thread** returns to its original **Project** even if that **Project** is in **Unavailable Project Context**.
- **Empty Trash** permanently deletes all **Trashed Threads**.
- The currently rendered **Thread** carries the **Active Thread Highlight**.
- The **Thread Panel** starts and displays **Threads**.
- Quick Note allows multiple simultaneous floating windows.
- Pomodoro and Calendar are singleton floating windows.
- Closing a satellite window hides its UI but does not necessarily stop background behavior.
- Closing a Custom Satellite Instance preserves its state and geometry so it can be reopened.
- Permanently deleting a Custom Satellite Instance requires a separate explicit action.
- Custom Satellite Types are user-defined; built-in Satellite Types remain fixed by Gravity.
- A running Pomodoro continues in the background and emits a toast notification with sound when a phase ends.
- A **Reminder** can fire whether or not the Calendar window is open.
- **Satellite State** persists across Gravity restarts. Custom Satellite geometry is persisted; built-in Satellite window position is currently ephemeral.
- Opening **Settings** remembers the active content surface; closing **Settings** returns to that surface (**Notes** or **Threads**), not always **Notes**.

## Ambiguities

- Deletion is reversible for 30 days through the **Trash Bin** for both **Chat Threads** and **Project Threads**.
- Deleting a **Thread** hides its runs, activity, results, and traces from active history until the thread is restored or permanently deleted.
- Restoring a **Project Thread** returns history to its original **Project**, but does not restore missing project context by itself.
- The **Thread Panel** is Gravity's primary interaction surface for both live work and thread continuity.
- The **Project Transfer Control** is only meaningful on an idle **Chat Thread** and disappears after upgrade.
- **Chats Header** and **Projects Header** are navigation containers, not thread states or project actions.
- A **Project Group** is a container for navigation, not a selectable thread.
- When a **Note** is the current note of one Quick Note window, it should appear as a ghost in the note list of another Quick Note window.
- The **Hub Activity Indicator** reflects live background activity, not unread counts.
- Custom Satellite geometry is persisted as part of its instance state; temporary drag state is not.

## Process Areas

- `src/main/bootstrap`: desktop startup and composition roots.
- `src/main/infrastructure`: app-level filesystem paths, desktop-specific services, and environment setup.
- `src/main/runtime`: main-process runtime session coordination and integration points.
- `src/main/ipc`: IPC registration and transport plumbing.
- `src/preload`: renderer-safe API exposure.
- `src/renderer/routes`: route-level composition.
- `src/renderer/surfaces/thread-panel`: primary thread surface and activity presentation.
- `src/renderer/surfaces/folder-system-panel`, `folder-view`, and `full-trace-view`: supporting desktop surfaces, including legacy areas that may be in transition.

## Rules

- Renderer code should consume application-facing models instead of inventing alternate lifecycle rules.
- Main-process code owns privileged access and native capabilities.
- Preload is the narrow bridge, not a second application layer.
- UI terminology should align with the domain context, especially for project, thread, run, session, and activity language.

## What Does Not Belong Here

- Direct domain-model redefinition.
- Persistence logic that should live in adapters.
- Product orchestration rules that belong in `@gravity/application`.

## ADR Scope

Use [docs/adr/](/C:/Users/devon/gravity/apps/desktop/docs/adr) for Electron-specific decisions about process boundaries, preload exposure, surface composition, and renderer interaction models.

Use [docs/adr/](/C:/Users/devon/gravity/docs/adr) as the ADR index and for cross-context decisions that are not owned solely by the desktop app.
