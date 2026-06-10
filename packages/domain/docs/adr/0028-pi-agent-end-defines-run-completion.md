# Pi agent_end defines run completion

Gravity will normalize Pi `agent_end` as the canonical completion boundary for a **Run**, while using the assistant message from the latest Pi `turn_end` as the source for assistant **Thread Messages** and final **Run Result** content. This follows Pi's documented completion pattern and avoids treating prompt promise resolution or individual turn completion as the product-level Run boundary.
