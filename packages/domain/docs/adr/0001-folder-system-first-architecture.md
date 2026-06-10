# Folder-system-first architecture

> Status: Superseded by `0014-folder-view-removal.md`.

We decided that the **Folder System** is a secondary surface that is focused retropespectively reviewing a threads run history, **Run** is a bounded execution against that system, and **Trace** is Gravity's own explanation of how the run moved through the system. Gravity therefore owns folder-system UX, and trace UX, while `pi` remains the underlying execution runtime behind a thin adapter. This keeps Gravity differentiated around folder structure, observability, and system design.
