# Agent-attributed trace events

> Status: Superseded by `0014-folder-view-removal.md`.

Gravity will only create **Trace Events** from runtime-scoped or otherwise confirmed agent attribution, using filesystem observation to confirm material disk changes before classifying work when needed. Raw filesystem changes without runtime attribution may refresh folder-system display state, but they will not enter trace history.

This decision keeps **Trace** focused on explaining how an agent moved through and acted on a folder system during a **Run**. Users are not **Actors**, and user-authored filesystem changes such as map edits should not appear in the **Trace Details Panel**. A broad file watcher alone is not enough evidence to say the agent performed work.

The trade-off is that Gravity may ignore some ambiguous filesystem changes even when they occur during an active run. That is preferable to misattributing user or external process activity to the agent. Future implementations can improve attribution and distinguish **Direct Work** from **Command Effect** by reconciling runtime events, command windows, and filesystem signals, but the product semantics remain agent-attributed.
