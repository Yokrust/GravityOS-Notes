# Best-effort runtime session resume

Gravity will persist **Runtime Session Records** for thread-scoped sessions and attempt to resume provider-native sessions after app restart when Pi exposes usable resume metadata. If resume is unavailable or fails, Gravity will mark the prior session as lost, preserve **Thread** continuity, stop any in-progress **Runs** with partial output, and create a new **Runtime Session** for the **Thread** when the user sends new work.
