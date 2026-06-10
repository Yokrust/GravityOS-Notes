# Runtime event contract in domain

Gravity will define the canonical **Runtime Event** contract in `packages/domain`, while keeping runtime event ports and ingestion services in `packages/application` and Pi-specific normalization in `packages/adapters`. This makes **Runtime Events** part of Gravity's provider-independent product language, prevents adapter-owned event shapes from leaking upward, and still keeps Pi parsing out of the side-effect-free domain package.
