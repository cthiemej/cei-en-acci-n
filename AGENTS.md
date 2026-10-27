# Architecture rules

- Use `storageFileName` for user-supplied filenames in storage keys, while preserving original names in document records; this avoids unsupported Unicode keys across upload forms.