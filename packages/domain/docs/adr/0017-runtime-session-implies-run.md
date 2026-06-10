# Runtime session implies run

Gravity will create a **Run** for any turn that opens a **Runtime Session**, including turns in **Chat Threads** with no attached **Project**. This removes the separate callback-only chat execution path over time, gives every runtime-backed turn stop/retry/recovery semantics, and keeps **Discussion-Only Turns** reserved for thread continuity that does not start runtime execution.
