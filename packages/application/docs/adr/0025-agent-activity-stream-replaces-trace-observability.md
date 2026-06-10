# Agent activity stream replaces trace as runtime observability model

Gravity will treat **Trace** as legacy persistence after Folder View, Thread Replay, and Trace Details removal, and will center runtime observability on the **Agent Activity Stream**. The first **Runtime Event Type** set will not include trace-signal events; tool, command, path, and output evidence should be carried through runtime item events and projected into activity-oriented records instead of expanding the legacy Trace model.
