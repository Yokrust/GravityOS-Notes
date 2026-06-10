# Canvas Folder View

> Status: Superseded by `0014-folder-view-removal.md`.

Gravity's **Folder View** will be a canvas-based folder-system map with automatically laid out file and folder nodes connected by parent-child relationships. It will not be a collapsible file tree, file manager, or user-positioned graph in v1.

This decision keeps the primary surface differentiated around visual trace comprehension instead of conventional filesystem navigation. The canvas can show how an agent moved through a folder system directly on the structure, while pan and zoom give users spatial control without implying that dragging nodes changes files on disk.

The trade-off is that Gravity must handle layout, density limits, and viewport controls deliberately. Users will not manually position nodes in v1 because that would create layout authorship without enough rules to keep relationships readable. Orbit-style and force-directed graph behavior are deferred until the simpler canvas map proves useful.
