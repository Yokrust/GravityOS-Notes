# Conservative active run limit

Gravity will initially allow at most one active **Run** per **Project** across all of that project's **Project Threads**, and at most one active **Run** per **Chat Thread**. This protects shared project context, file attribution, and trace reliability until Gravity has a safe project-level concurrency model; the restriction is intentionally revisitable so multiple active runs within one project can be added later with explicit locking or conflict semantics.
