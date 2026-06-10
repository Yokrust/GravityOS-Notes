# First runtime event type set

> Superseded in part by `0025-agent-activity-stream-replaces-trace-observability.md`, which removes trace-signal events from the first runtime event set.

Gravity's first **Runtime Event Type** set will cover session lifecycle, session compaction, graceful shutdown, lost sessions, run lifecycle, turn lifecycle, assistant message lifecycle, reasoning lifecycle, item lifecycle, trace signals, warnings, and errors. Gravity will not mirror every Pi provider event name; Pi-specific session switch, fork, tree events and UI/RPC request events remain **Runtime Source Events** until Gravity defines product semantics for them.
