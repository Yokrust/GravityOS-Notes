# PRD: Gravity Notes

## Problem Statement

Users who want to take notes, develop projects, or learn need a dedicated writing space that is organized, connected to their filesystem, and augmented by AI — without leaving GravityOS. The current notes surface stores content in an internal database, not on disk, offers no linking between notes, and provides no path for the AI agent to read or modify note content in a controlled way. Users cannot use their own folder structure, cannot reference other notes inline, and cannot delegate writing or organization tasks to the AI with confidence that they stay in control.

## Solution

Gravity Notes is a filesystem-backed note-taking surface within GravityOS. The user selects a local folder (the Notebook Root) once; all Notes and Folders inside it are real `.md` files and directories on disk. Notes are written in a free-form markdown Canvas with Satellites — floating widgets — positioned freely on top. Notes can reference each other via `[[Note Title]]` links that update automatically on rename or move. The AI agent can read Notes from any Thread and propose changes (edits, appends, moves, creates, deletes) through a Scratchpad — a diff-based staging layer the user reviews and accepts or rejects as an atomic unit before anything touches the filesystem.

## User Stories

### Notebook Root Setup

1. As a user, I want to select a local folder as my Notebook Root the first time I open Gravity Notes, so that all my notes are real files I own and can access outside Gravity.
2. As a user, I want Gravity Notes to remember my Notebook Root between sessions, so that I do not have to re-select it every time I open the app.
3. As a user, I want to change my Notebook Root at any time, so that I can relocate my notes without losing them.
4. As a user, I want Gravity Notes to tell me clearly when my Notebook Root is missing or unreachable, so that I know why the app cannot load my notes.

### Note Tree

5. As a user, I want to see all my Notes and Folders displayed as a tree in the sidebar that mirrors my actual filesystem, so that what I see in Gravity matches what is on my disk.
6. As a user, I want to create a new Note inside any Folder or at the root of the Notebook, so that I can organize content wherever makes sense.
7. As a user, I want to create a new Folder anywhere in the tree, so that I can group related Notes.
8. As a user, I want to rename a Note or Folder inline in the Note Tree, so that I can keep my organization up to date without leaving the sidebar.
9. As a user, I want to delete a Note or Folder from the tree, so that I can remove content I no longer need.
10. As a user, I want to move a Note into a different Folder by dragging it in the tree, so that I can reorganize without going to the filesystem.
11. As a user, I want the Note Tree to reflect changes made externally (e.g., files moved in Finder), so that Gravity stays in sync with my disk.
12. As a user, I want Folders to be expandable and collapsible in the Note Tree, so that I can focus on the part of the hierarchy I care about.
13. As a user, I want Folders to support unlimited nesting depth, so that I can mirror any folder structure I already have on disk.

### Canvas and Editing

14. As a user, I want to click a Note in the tree and see it open immediately in the Canvas, so that switching between notes is instant.
15. As a user, I want to write freely in markdown in the Canvas, so that I can structure my notes however I prefer.
16. As a user, I want the Canvas to show the note title as a large editable heading at the top, so that renaming is natural and in-context.
17. As a user, I want to see word count and last-edited time for the active Note, so that I have a sense of the note's depth and freshness.
18. As a user, I want my edits to be saved to disk automatically with a short debounce, so that I never lose work.
19. As a user, I want to position Satellites freely anywhere on the Canvas, so that my tools stay exactly where I placed them regardless of which Note is open.
20. As a user, I want my Satellite positions and states to persist between sessions, so that my workspace is consistent every time I open Gravity Notes.

### Note Links

21. As a user, I want to type `[[Note Title]]` inside any Note and have it render as a clickable link, so that I can connect related Notes naturally in prose.
22. As a user, I want clicking a Note Link to open the referenced Note in the Canvas, so that navigation between linked Notes is seamless.
23. As a user, I want a Broken Link (a reference to a Note that no longer exists) to be shown visually as unresolvable in the editor, so that I can identify and fix stale references.
24. As a user, I want Gravity to automatically update all Note Links that reference a Note when I rename it, so that I never end up with broken links from my own rename operations.
25. As a user, I want Gravity to automatically update all Note Links that reference a Note when I move it to a different Folder, so that links stay valid regardless of restructuring.
26. As a user, I want Note Links to be resolved by title within the Notebook Root, so that I do not have to manage paths manually.

### AI Integration via the Agent Harness

27. As a user, I want to ask the AI agent in any Thread to read one of my Notes, so that I can discuss, summarize, or reason about its content without leaving the Chat.
28. As a user, I want to ask the AI to edit the content of a Note and see the proposed changes in a Scratchpad before anything is written to disk, so that I stay in control of my files.
29. As a user, I want to ask the AI to append content (e.g., exercises, summaries, questions) to an existing Note and review what it intends to add before accepting, so that I can validate AI-generated content.
30. As a user, I want to ask the AI to create a new Note in a specific Folder and review it in the Scratchpad before it is written to disk, so that nothing is created without my approval.
31. As a user, I want to ask the AI to rename a Note or Folder and see the rename as a Proposed Change in the Scratchpad, so that AI-driven reorganization follows the same review path as everything else.
32. As a user, I want to ask the AI to move a Note to a different Folder and review the move in the Scratchpad, so that the AI cannot relocate my files without my confirmation.
33. As a user, I want to ask the AI to delete a Note and see the deletion as a Proposed Change in the Scratchpad, so that the AI cannot remove files without my explicit approval.
34. As a user, I want the AI to have automatic read access to my Notebook Root from any Thread, so that I do not have to explicitly grant access every time I want AI assistance with my notes.

### Scratchpad

35. As a user, I want all AI-proposed changes to appear in a Scratchpad panel before being applied, so that I have one clear place to review everything the AI wants to do.
36. As a user, I want the Scratchpad to show each Proposed Change as a diff (before and after), so that I can see exactly what the AI intends to modify.
37. As a user, I want to accept the Scratchpad with a single action and have all Proposed Changes applied to the filesystem at once, so that accepting is fast and the result is consistent.
38. As a user, I want to reject the Scratchpad with a single action and have none of the Proposed Changes applied, so that I can discard AI proposals without partial state.
39. As a user, I want the Scratchpad to be cleared after I accept or reject it, so that the next AI interaction starts with a clean slate.
40. As a user, I want accepting a Scratchpad that contains a rename or move to also automatically update all affected Note Links, so that the AI can reorganize my Notebook without breaking my link graph.

## Implementation Decisions

### Note Link Engine (new — domain package)

A pure, stateless module that parses `[[Title]]` references from markdown content, resolves them against the current Note Tree, detects Broken Links, and rewrites all affected Note Links when a Note is renamed or moved. Takes no dependencies on the filesystem or renderer. Accepts the Note Tree as plain data, making it fully deterministic and easy to test.

### Filesystem Note Adapter (new — adapters package)

Replaces the current SQLite-backed note content persistence. Reads and writes real `.md` files from the Notebook Root path. Provides a file-watch capability so the renderer can react to external changes (files added, renamed, or deleted outside Gravity). Exposes a clean port interface so the application layer and tests can substitute an in-memory implementation.

### Notebook Root Service (new — application package)

Manages the lifecycle of the selected Notebook Root: validating that the path exists and is a readable directory, persisting the path to the app database, and surfacing a clear status (available, missing, not-yet-selected) to the renderer.

### Scratchpad Service (new — application package)

Accumulates Proposed Changes from the AI agent, computes per-change diffs against the current filesystem state, and applies or rejects the full set atomically. On accept, delegates each write, move, or delete to the Filesystem Note Adapter and triggers a Note Link update pass for any rename or move operations. On reject, discards the accumulated changes with no side effects.

### Notes IPC Bridge (modified — main/ipc)

Adds new IPC handlers: `notes:select-notebook-root`, `notes:get-notebook-root-status`, `notes:read-tree`, `notes:read-note`, `notes:watch-tree`, `notes:apply-scratchpad`, `notes:reject-scratchpad`. Retires the current `notes:save-state` / `notes:get-state` pattern for note content (SQLite-backed) in favor of the filesystem adapter.

### Note Store (modified — renderer)

Updates the existing Zustand/reducer store to read the Note Tree from the filesystem via IPC instead of from in-memory seeded data. Adds Scratchpad state (pending proposed changes, open/closed). Removes the SQLite save loop for note content.

### Scratchpad UI (new — renderer)

A panel that appears when the Scratchpad has pending Proposed Changes. Renders each change with a before/after diff view. Provides Accept and Reject actions. Closes automatically after the user decides.

### Note Link Renderer (modified — BlockEditor)

Extends the existing BlockEditor to recognize `[[Title]]` syntax. Resolved links render as clickable text that navigates to the target Note. Broken Links render with a distinct visual style (e.g., muted color with a strikethrough or warning indicator).

## Testing Decisions

Good tests for this feature verify observable behavior through the public interface of each module — they do not assert on internal state, intermediate steps, or implementation details. A test should break only if the externally visible contract changes.

### Note Link Engine (domain package)

- Verify that `[[Title]]` in content resolves to the correct Note when a match exists in the tree.
- Verify that a reference to a missing Note is flagged as a Broken Link.
- Verify that renaming Note A updates every `[[A]]` reference across a multi-note tree to `[[new name]]`.
- Verify that moving a Note does not change its title and therefore does not affect existing Note Links.
- Verify that a Note with no links returns an empty result set from Broken Link detection.

### Scratchpad Service (application package)

- Verify that accepting an edit Proposed Change writes the new content to the filesystem adapter.
- Verify that accepting an append Proposed Change appends content without overwriting existing text.
- Verify that rejecting a Scratchpad leaves all notes unchanged.
- Verify that accepting a rename Proposed Change triggers a Note Link update pass across the Notebook.
- Verify that a delete Proposed Change, when accepted, removes the Note and marks any references to it as Broken Links.
- Verify that a mixed batch (create + move + edit) is applied atomically — all succeed or none apply.

### Notebook Root Service (application package)

- Verify that selecting a valid path persists it and returns an available status.
- Verify that selecting a non-existent path returns a missing status and does not persist.
- Verify that hydrating with no previously saved path returns a not-yet-selected status.

Prior art: see `packages/application/tests/notes-service.test.ts` for the existing pattern — services are tested with `createInMemoryPersistence()` from the testkit, no real filesystem or SQLite required.

## Out of Scope

- **Tags** — note organization is through Folders and Note Links only. Tags may be added in a future iteration.
- **Multiple Notebooks** — there is exactly one Notebook per user. Multi-notebook support is not planned for this PRD.
- **Virtual Note Tree views** — no "Recents", "Favorites", or "All Notes" smart sections. The Note Tree mirrors the filesystem only.
- **Inline AI commands** — the AI is invoked exclusively from the Chat Thread. There are no in-editor AI shortcuts (e.g., `/ai` commands) in this PRD.
- **Backlink panel** — the ability to see which Notes link to the currently open Note is not included in this PRD.
- **New Satellite types** — additional Satellites specific to Gravity Notes (e.g., AI Chat Satellite, Flashcard Satellite) are acknowledged as future work but not specified here.
- **Conflict resolution** — if the filesystem and Gravity's in-memory state diverge (e.g., concurrent external edits), resolution strategy is out of scope for this PRD.
- **Note history / version control** — no undo beyond the editor's native undo. Version history is out of scope.

## Further Notes

- The Scratchpad is the only path through which the AI can modify the Notebook filesystem. No AI operation bypasses it.
- The Notebook Root is independent from the Agent Harness's Project Context Attachment. They are separate local directory selections with different lifecycles.
- Note Links are resolved by title, not by file path. This means two Notes with the same title create an ambiguous link — resolution strategy for duplicates should be defined before implementing the Note Link Engine.
- The existing `FileNode` type and `NotesService` in the application package form the starting point but will need significant revision to support filesystem-backed content and the Notebook Root lifecycle.
- Gravity Notes lives under the `gravity-notes` branch. All implementation for this PRD is scoped to that branch.
