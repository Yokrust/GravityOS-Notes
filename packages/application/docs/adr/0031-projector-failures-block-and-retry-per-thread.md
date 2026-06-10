# Projector failures block and retry per thread

Gravity's **Projector Worker** will process **Runtime Events** in thread order. If projecting an event fails, later projections for that **Thread** are blocked while the projector retries the failed event with bounded backoff; if retries are exhausted, Gravity exposes a degraded projection state with recovery advice while preserving the **Runtime Event Log** for retry or rebuild.
