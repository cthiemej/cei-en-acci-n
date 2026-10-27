/** Storage keys use ASCII; document records retain the original display name. */
export function storageFileName(name: string): string {
  const safeName = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+/, '')
    .slice(-180);
  return safeName || 'documento';
}