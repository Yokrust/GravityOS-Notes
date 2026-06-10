# Remove trace persistence in a dedicated vertical slice

Gravity will remove **Trace** code and persistence in a dedicated vertical slice instead of carrying it forward into the new runtime event backend. After Folder View, Thread Replay, and Trace Details removal, new **Runs** should project observability into the **Agent Activity Stream** and **Run Result** rather than creating or updating **Trace** records.
