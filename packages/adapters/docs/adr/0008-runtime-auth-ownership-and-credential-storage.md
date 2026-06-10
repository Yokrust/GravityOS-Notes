# Runtime auth ownership and credential storage

Gravity will own provider selection UX, authentication status surfaces, and secure IPC entry points for login or API-key setup, while Electron Main executes the underlying auth flow and storage access through `pi`'s SDK or auth storage APIs. The renderer never handles provider credentials directly. This preserves Gravity's product control over the experience without reimplementing provider-specific authentication, token refresh, or credential resolution that `pi` already owns.
