import { ZodError, ZodIssue } from 'zod';

/**
 * Converte un ZodError in un messaggio leggibile in italiano per l'utente
 * finale, invece di restituire il JSON grezzo degli issue (che il cliente
 * vedeva come "errore in codice" nel toast).
 *
 * Esempio output: "Peso: deve essere un numero · Immagine: URL non valido"
 */
export function formatZodError(error: ZodError): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const issue of error.issues) {
    const label = fieldLabel(issue);
    const msg = issueMessage(issue);
    const line = label ? `${label}: ${msg}` : msg;
    if (seen.has(line)) continue;
    seen.add(line);
    parts.push(line);
  }

  if (parts.length === 0) return 'Dati non validi';
  return parts.join(' · ');
}

/**
 * True se l'errore è un ZodError (anche quando arriva come unknown dal catch).
 */
export function isZodError(error: unknown): error is ZodError {
  return (
    error instanceof ZodError ||
    (typeof error === 'object' && error !== null && (error as any).name === 'ZodError')
  );
}

/**
 * Estrae un messaggio leggibile da un errore qualsiasi: ZodError → italiano,
 * Error → message, fallback generico.
 */
export function toReadableError(error: unknown, fallback = 'Si è verificato un errore'): string {
  if (isZodError(error)) {
    // L'oggetto potrebbe non essere istanza di ZodError ma avere .issues
    const zerr = error instanceof ZodError ? error : ({ issues: (error as any).issues || (error as any).errors || [] } as ZodError);
    return formatZodError(zerr);
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

// Etichette italiane per i campi più comuni delle varianti/prodotti.
const FIELD_LABELS: Record<string, string> = {
  sku: 'SKU',
  name: 'Nome',
  attributes: 'Attributi',
  barcode: 'Barcode',
  costDelta: 'Costo aggiuntivo',
  priceDelta: 'Prezzo aggiuntivo',
  weight: 'Peso',
  dimensions: 'Dimensioni',
  width: 'Larghezza',
  height: 'Altezza',
  depth: 'Profondità',
  webPrice: 'Prezzo web',
  webDescription: 'Descrizione web',
  mainImageUrl: 'Immagine',
  isActive: 'Stato',
  price: 'Prezzo',
  cost: 'Costo',
  categoryIds: 'Categorie',
  productId: 'Prodotto',
};

function fieldLabel(issue: ZodIssue): string {
  const path = issue.path.filter((p) => typeof p === 'string') as string[];
  if (path.length === 0) return '';
  const last = path[path.length - 1];
  return FIELD_LABELS[last] || last;
}

function issueMessage(issue: ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      if ((issue as any).received === 'undefined' || (issue as any).received === 'null') {
        return 'campo obbligatorio';
      }
      return 'valore non valido';
    case 'too_small':
      return 'valore troppo corto o troppo basso';
    case 'too_big':
      return 'valore troppo lungo o troppo alto';
    case 'invalid_string':
      if ((issue as any).validation === 'url') return 'URL non valido';
      return 'formato non valido';
    case 'invalid_enum_value':
      return 'valore non ammesso';
    default:
      // Messaggio Zod di default (può essere in inglese) come ultima risorsa
      return issue.message || 'valore non valido';
  }
}
