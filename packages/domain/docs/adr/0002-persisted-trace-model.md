# Persisted trace model

> Status: Superseded by `0014-folder-view-removal.md`.

Gravity will persist **Trace** as a first-class product object instead of reconstructing it on demand from raw runtime logs. A trace begins when a **Run** starts, updates live as confirmed activity is observed, and finalizes when the run completes, fails, or stops. This decision supports the live **Folder View**, the **Trace Details Panel**, future **Replay**, and later actor attribution, while keeping Gravity's product semantics decoupled from whatever raw event formats the execution runtime exposes.
