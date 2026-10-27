export function normalizeEmailAddress(value: string): string {
  const trimmed = value.trim();
  const match = /^[^<>]*<([^<>]+)>$/.exec(trimmed);
  const address = (match?.[1] ?? trimmed).trim();
  if (!/^[^<>()\[\]\\,;:\s@"]+@[a-zA-Z0-9-]+\.([a-zA-Z0-9-]+\.)*[a-zA-Z]{2,}$/.test(address)) {
    throw new Error('Dirección de correo inválida. Revisa GMAIL_ADDRESS y el correo del destinatario.');
  }
  return address;
}

export function normalizeAppPassword(value: string): string {
  // Google displays app passwords in groups separated by spaces.
  return value.replace(/\s/g, '');
}

export function emailErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/535|5\.7\.8|BadCredentials/i.test(message)) {
    return 'Gmail rechazó las credenciales. Revisa GMAIL_ADDRESS y usa una contraseña de aplicación vigente en GMAIL_APP_PASSWORD (no la contraseña habitual).';
  }
  return message;
}