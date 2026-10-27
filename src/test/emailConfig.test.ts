import { describe, expect, it } from 'vitest';
import { normalizeEmailAddress, normalizeAppPassword, emailErrorMessage } from '../../supabase/functions/send-notification/emailConfig';

describe('Gmail configuration', () => {
  it('extracts a bare sender from a pasted display address', () => {
    expect(normalizeEmailAddress(' CEI-UDP <test@gmail.com> ')).toBe('test@gmail.com');
  });
  it('rejects invalid senders before opening SMTP', () => {
    expect(() => normalizeEmailAddress('not an email')).toThrow('Dirección de correo inválida');
  });
  it('removes the spacing Google uses to display app passwords', () => {
    expect(normalizeAppPassword(' abcd efgh ijkl mnop\n')).toBe('abcdefghijklmnop');
  });
  it('explains rejected credentials without a raw SMTP stack', () => {
    expect(emailErrorMessage(new Error('535: 5.7.8 BadCredentials'))).toContain('contraseña de aplicación vigente');
  });
});