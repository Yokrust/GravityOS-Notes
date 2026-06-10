# Gravity-owned runtime event contract

Gravity will translate raw `pi` runtime events into a Gravity-owned runtime event contract before application services, persistence, or renderer IPC consume them. This keeps run orchestration, activity persistence, and trace translation insulated from `pi` event churn, and lets Gravity evolve its own product semantics without binding core code to external event shapes.
