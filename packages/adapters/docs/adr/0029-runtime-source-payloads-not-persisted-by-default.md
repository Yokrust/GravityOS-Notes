# Runtime source payloads are not persisted by default

Gravity will not persist full raw provider payloads for **Runtime Source Events** by default. Production persistence keeps only safe **Runtime Source Event Metadata** for correlation, while normalized **Runtime Events** remain the durable source for product behavior; full raw payload capture is limited to explicit development diagnostics or fixture capture so Gravity does not rely on fragile redaction of sensitive prompts, file content, command output, or credentials.
