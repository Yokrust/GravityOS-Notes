# Snapshot plus committed runtime event stream

Gravity will hydrate renderer state from a **Thread Snapshot** with an **Applied Runtime Sequence**, then deliver subsequent committed **Runtime Events** over the live stream. The renderer applies events in sequence, ignores duplicates or stale events, and uses **Event Catch-Up** when it detects a sequence gap; durable server-side projections remain responsible for snapshots, while live UI movement follows committed events.
