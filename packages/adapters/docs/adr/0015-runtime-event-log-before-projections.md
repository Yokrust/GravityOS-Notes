# Runtime event log before projections

Gravity will append normalized **Runtime Events** to a durable, ordered **Runtime Event Log** before deriving thread messages, activity items, traces, run status, or run results. This preserves a replayable backend timeline for runtime-derived state while keeping the existing projection tables as read models for snapshots, avoiding a full app-wide event-sourcing rewrite before the runtime event spine is proven.
