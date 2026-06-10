# Hybrid runtime event projection

Gravity will append **Runtime Events** transactionally and perform only minimal **Consistency-Critical Projections** in the append transaction, such as invariants, tiny denormalizations needed for immediate command decisions, and low-cost deterministic updates. Heavier user-facing materialized views, including messages, activity, runs, traces, and results, will be derived after commit by an ordered **Projector Worker**.
