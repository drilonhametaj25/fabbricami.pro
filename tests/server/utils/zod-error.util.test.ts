import { z } from 'zod';
import { formatZodError, isZodError, toReadableError } from '@server/utils/zod-error.util';

describe('zod-error.util', () => {
  const variantSchema = z.object({
    sku: z.string().min(1),
    name: z.string().min(1),
    weight: z.number().optional(),
    mainImageUrl: z.string().url().optional(),
  });

  it('produces a readable Italian message instead of raw JSON', () => {
    const result = variantSchema.safeParse({ sku: '', name: 'X', weight: null });
    expect(result.success).toBe(false);
    if (result.success) return;

    const msg = formatZodError(result.error);
    // Non deve contenere parentesi graffe / sintassi JSON grezza
    expect(msg).not.toMatch(/[{}\[\]]/);
    // Deve menzionare i campi con etichette italiane
    expect(msg).toContain('SKU');
    expect(msg).toContain('Peso');
  });

  it('maps null number to "campo obbligatorio"-style message, not a stack of code', () => {
    const result = variantSchema.safeParse({ sku: 'A', name: 'B', weight: null as any });
    if (result.success) throw new Error('expected failure');
    const msg = formatZodError(result.error);
    expect(msg.toLowerCase()).toContain('peso');
  });

  it('labels invalid URL clearly', () => {
    const result = variantSchema.safeParse({ sku: 'A', name: 'B', mainImageUrl: 'not-a-url' });
    if (result.success) throw new Error('expected failure');
    const msg = formatZodError(result.error);
    expect(msg).toContain('Immagine');
    expect(msg).toContain('URL non valido');
  });

  it('isZodError detects both instances and error-like objects', () => {
    const result = variantSchema.safeParse({ sku: '', name: '' });
    if (result.success) throw new Error('expected failure');
    expect(isZodError(result.error)).toBe(true);
    expect(isZodError({ name: 'ZodError', issues: [] })).toBe(true);
    expect(isZodError(new Error('plain'))).toBe(false);
  });

  it('toReadableError falls back to Error.message and generic string', () => {
    expect(toReadableError(new Error('boom'))).toBe('boom');
    expect(toReadableError('just a string')).toBe('just a string');
    expect(toReadableError(undefined, 'fallback')).toBe('fallback');
  });
});
