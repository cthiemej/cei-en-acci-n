import { describe, expect, it } from 'vitest';
import { storageFileName } from '@/lib/storageFileName';

describe('storageFileName', () => {
  it('accepts the reported filename with a long dash and a decomposed accent', () => {
    expect(storageFileName('Manual del estudiante — Simulador de Economi\u0301a Circular.docx'))
      .toBe('Manual_del_estudiante_Simulador_de_Economia_Circular.docx');
  });

  it('normalizes composed accents and disallows path separators and symbols', () => {
    expect(storageFileName('../Carta/compromiso: revisión?.pdf')).toBe('Carta_compromiso_revision_.pdf');
  });

  it('preserves ordinary filenames and their extensions', () => {
    expect(storageFileName('protocolo-v2.docx')).toBe('protocolo-v2.docx');
  });

  it('provides a nonempty key when no safe characters remain', () => {
    expect(storageFileName('📄')).toBe('documento');
  });
});