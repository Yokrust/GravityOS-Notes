# Activity items are thread-owned

Gravity will make **Activity Items** owned by **Threads**, with an optional **Run** reference when the activity occurs during a **Run**. This matches the thread-scoped **Runtime Session** model, allows session-level activity such as compaction or lost-session warnings to appear without inventing synthetic Runs, and still lets Run views filter activity by Run.
