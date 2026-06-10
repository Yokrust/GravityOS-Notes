# Direct filesystem as source of truth

Gravity will treat the live filesystem as the source of truth for folder-system content and structure instead of introducing an internal document model on top of files. Reader, editor, and folder-system surfaces should operate on real folders and files, while Gravity-owned metadata such as role assignments, traces, and app state remain separate. This preserves the local-first product model, keeps content portable outside the app, and avoids the sync complexity and lock-in that an internal document model would introduce.
