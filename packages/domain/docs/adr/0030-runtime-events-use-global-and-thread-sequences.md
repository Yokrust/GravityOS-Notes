# Runtime events use global and thread sequences

Gravity will assign both a global runtime event sequence and a per-thread runtime event sequence when appending **Runtime Events**. The global sequence preserves total ordering for diagnostics, while the per-thread sequence gives thread subscriptions a deterministic cursor for duplicate detection, stale-event guards, and **Event Catch-Up**. The first renderer stream may still use snapshot rehydration plus live resubscription while the backend keeps the stronger catch-up capability available.
