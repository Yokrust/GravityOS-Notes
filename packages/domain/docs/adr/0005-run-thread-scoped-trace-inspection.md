# Run-thread-scoped trace inspection

> Status: Superseded by `0014-folder-view-removal.md`.

Gravity will organize user-facing run history through **Run Threads** scoped to a **Folder System**. The **Trace Details Panel** will inspect trace history for one selected run thread, grouped by run, while the **Folder View** visualizes one run trace at a time. Gravity will not persist a separate thread-level trace object; run-thread trace history is derived from the persisted traces owned by each run.

This replaces the earlier idea of a standalone full trace view for one run at a time. A run-thread-scoped panel fits the product better because users reason about repeated attempts and results within a thread, while the Folder View still needs a single active trace to keep visual highlights legible. This also avoids making individual run-result cards the only way to recover trace details.

The trade-off is that the Trace Details Panel must provide a lightweight run switcher for the selected thread. Gravity accepts that UI responsibility in exchange for keeping trace inspection contextual, avoiding global cross-folder-system trace history, and preserving the invariant that each **Run** owns exactly one persisted **Trace**.
