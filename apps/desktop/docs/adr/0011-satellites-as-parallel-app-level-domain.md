# Satellites as a parallel app-level domain

Satellites and their domain entities — Notes, Reminders, and Pomodoro state — live as an app-level domain independent of Folder Systems and Runs, persisted at the Gravity application layer rather than as folder-system metadata. We chose this over scoping Satellites per Folder System because Satellites serve a personal-productivity purpose unrelated to the agent observability flow, and folding them into folder-system metadata would force them to inherit Folder-System-centric concepts (selection, paths, traces, run threads) that they have no use for and would muddy.

Gravity-owned built-in Satellite Types remain fixed, while users may define Custom Satellite Types with generated field schemas. Each Custom Satellite Instance persists its values, visibility, position, size, and stack order. Closing an instance changes visibility only; permanent deletion is a distinct explicit operation.
