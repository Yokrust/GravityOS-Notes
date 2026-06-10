# Thread-scoped runtime sessions

Gravity will scope **Runtime Sessions** to **Threads** rather than individual **Runs**, allowing a long-lived Pi session to carry provider-native continuity across multiple runtime-backed turns. **Runs** remain the bounded execution records within that session, so Gravity can preserve stop, retry, result, and recovery semantics while still supporting long-lived provider sessions.
