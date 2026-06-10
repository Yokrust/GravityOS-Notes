# Separate activity, trace, and run-result persistence

Gravity will persist the **Agent Activity Stream**, **Trace**, and **Run Result** as separate first-class records owned by a **Run** instead of collapsing them into one transcript-like object. This preserves the distinction between raw runtime activity, Gravity's curated explanation of movement and work, and the user-facing outcome, which in turn supports Folder View and Replay behavior, and future evolution of each layer independently.
