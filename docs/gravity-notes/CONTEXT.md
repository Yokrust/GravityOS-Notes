# Gravity Notes

Gravity Notes is the note-taking context within GravityOS. It defines how users write, organize, and interact with notes stored as files on disk, and how the AI agent proposes changes to that content through a controlled review layer.

## Language

### Content

**Note**:
A markdown file on disk that the user writes and edits inside the Canvas.
_Avoid_: Document, page, entry, record

**Folder**:
A directory on disk that organizes Notes hierarchically inside the Notebook Root.
_Avoid_: Category, tag, group, section

**Notebook**:
The single fixed container for all of the user's Notes and Folders in Gravity Notes. There is exactly one per user.
_Avoid_: Workspace, vault, library, project

**Notebook Root**:
The local directory chosen once by the user that backs the Notebook. All Notes and Folders live inside it as real files and directories on the filesystem.
_Avoid_: Vault path, project folder, working directory, Project Context Attachment

### Navigation

**Note Tree**:
The hierarchical sidebar view that mirrors the Notebook Root's filesystem structure — Notes and Folders as a navigable tree.
_Avoid_: File explorer, sidebar list, document list

### Editing Surface

**Canvas**:
The writing and editing area where the active Note is displayed. Satellites float freely on top of it.
_Avoid_: Editor, document view, thread panel, workspace

**Satellite**:
A floating widget the user positions freely on the Canvas. Satellites are global to the Notebook — their position and state persist regardless of which Note is open.
_Avoid_: Panel, widget, sticky, tool window

### Linking

**Note Link**:
A reference from one **Note** to another within the same **Notebook**, written as `[[Note Title]]` inline in the markdown content.
_Avoid_: Backlink, mention, hyperlink, internal link

**Broken Link**:
A **Note Link** whose target **Note** no longer exists in the **Notebook**. Displayed visually as unresolvable in the editor but does not block the user from writing.
_Avoid_: Dead link, invalid reference, orphan link

### AI Integration

**Scratchpad**:
The staging layer where the AI deposits an atomic set of **Proposed Changes** before the user accepts or rejects them as a unit. Presents each change as a diff — before and after — so the user can see exactly what the AI intends to modify.
_Avoid_: Draft, preview, suggestion queue, AI output

**Proposed Change**:
A single AI-authored operation inside the **Scratchpad**. Valid types: create a **Note**, edit the full content of a **Note**, append content to a **Note**, rename a **Note** or **Folder**, move a **Note** to a different **Folder**, delete a **Note**, or create a **Folder**.
_Avoid_: Edit, diff, suggestion, patch

## Relationships

- The **Notebook** has exactly one **Notebook Root**
- The **Notebook Root** is a local directory independent from any Agent Harness **Project Context Attachment**
- A **Note** is a markdown file inside the **Notebook Root**
- A **Folder** is a directory inside the **Notebook Root**
- A **Note** can live at the root of the **Notebook** or inside any **Folder**
- A **Folder** can contain other **Folders** and **Notes** at any depth
- The **Note Tree** mirrors the **Notebook Root** filesystem structure
- The **Canvas** displays exactly one **Note** at a time
- **Satellites** float on the **Canvas** and are global to the **Notebook**
- The AI proposes changes to **Notes** and **Folders** exclusively through the **Scratchpad**
- A **Scratchpad** contains one or more **Proposed Changes** as an atomic unit
- A **Proposed Change** can be: create, edit, append, rename, move, or delete a **Note**; or create or rename a **Folder**
- Accepting the **Scratchpad** applies all **Proposed Changes** to the filesystem at once
- Rejecting the **Scratchpad** leaves all **Notes** and **Folders** unchanged
- The AI cannot write directly to the filesystem — the **Scratchpad** is the only path
- The **Notebook Root** is a globally available resource — the agent can access it from any **Thread** without requiring explicit **Granted Access**
- A **Note Link** written as `[[Note Title]]` resolves to the target **Note** within the same **Notebook Root**
- A **Note** can contain many **Note Links**; a **Note** can be the target of many **Note Links** from other **Notes**
- When a **Note** is renamed or moved by the user, Gravity automatically updates all **Note Links** that reference it across the **Notebook**
- If the target **Note** of a **Note Link** is deleted, that link becomes a **Broken Link**
- When a **Proposed Change** in the **Scratchpad** includes a rename or move, accepting it triggers the same automatic **Note Link** update

## Example dialogue

> **Dev:** "When the AI rewrites a Note, does it write directly to disk?"
> **Domain expert:** "No. The changes go into the **Scratchpad** first. The user reviews the full set and accepts or rejects it as a unit."
>
> **Dev:** "If the AI moves three notes and edits one, can the user accept just the edits?"
> **Domain expert:** "No — the **Scratchpad** is atomic. The user accepts or rejects the entire proposed changeset."
>
> **Dev:** "Where do Satellites save their state? Per Note or globally?"
> **Domain expert:** "Globally. A **Satellite**'s position and state belong to the **Notebook**, not to any specific **Note**."
>
> **Dev:** "Can I call the local folder the user picks a 'vault'?"
> **Domain expert:** "No — that's the **Notebook Root**. 'Vault' is Obsidian's term. We own **Notebook Root**."
>
> **Dev:** "If the user has a Project in the Agent Harness that points to their code folder, can the Notebook Root be the same folder?"
> **Domain expert:** "No. The **Notebook Root** is independent. Notes and project working context are separate concerns."
>
> **Dev:** "If the user renames a Note, do we need to scan all other Notes and patch the links manually?"
> **Domain expert:** "Gravity handles it automatically. Renaming a **Note** triggers an update to every **Note Link** that references it across the **Notebook**."
>
> **Dev:** "The user asked the AI to add 20 exercises to a Note and also move another Note to /Trabajo. Can they approve just the exercises and skip the move?"
> **Domain expert:** "No. The **Scratchpad** is atomic — both **Proposed Changes** go in as one unit. The user accepts or rejects everything together."
>
> **Dev:** "A Note has a link to a Note the AI just deleted via Scratchpad. Does that break when the user accepts?"
> **Domain expert:** "Yes — that **Note Link** becomes a **Broken Link**. Gravity shows it as unresolvable but doesn't block the user."
>
> **Dev:** "Is the Note Tree stored in a database we own?"
> **Domain expert:** "No. The **Note Tree** is a live mirror of the **Notebook Root** on disk. The filesystem is the source of truth."

## Flagged ambiguities

- **Canvas** in Gravity Notes means the note editing surface, not a spatial infinite canvas where Notes are positioned. Notes are navigated through the **Note Tree**, not placed spatially.
- **Satellite** is a shared term with the Agent Harness surface but belongs to the Notes Canvas here. Satellites are global to the **Notebook**, not scoped per **Note**.
- **Notebook Root** is not a **Project Context Attachment**. They are independent concepts even though both refer to a local directory the user selects.
- **Scratchpad** is the only path through which the AI modifies the filesystem in Gravity Notes. Direct writes without user review are not permitted.
