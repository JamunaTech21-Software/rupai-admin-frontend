/**
 * Types shared across features. This folder imports nothing from features/, app/, ui/ or lib/.
 */

/** A decimal transmitted as a string, e.g. `"12345.6700"` (Spec P4 §2.3). Never a JavaScript number. */
export type DecimalString = string & { readonly __brand: 'DecimalString' };

/** A business date `YYYY-MM-DD`, with no time and no zone (Spec P4 §2.3). */
export type BusinessDate = string & { readonly __brand: 'BusinessDate' };

/** A BIGINT id, transmitted as a string (Spec P4 §2.3). */
export type Id = string & { readonly __brand: 'Id' };
