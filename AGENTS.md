# Architecture rules

- Use `storageFileName` for user-supplied filenames in storage keys, while preserving original names in document records; this avoids unsupported Unicode keys across upload forms.
- Normalize and validate SMTP email addresses before constructing the mail client and always close it after sending; this prevents malformed sender errors and orphaned connections.