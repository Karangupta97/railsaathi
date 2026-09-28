/**
 * Emergency helplines.
 *
 * PLACEHOLDERS: every number must be verified against current official
 * sources before launch. `verified` stays false until then and the UI shows
 * a "numbers to be verified" note.
 */
export type Helpline = {
  number: string;
  name: string;
  description: string;
  verified: boolean;
};

export const HELPLINES: readonly Helpline[] = [
  { number: "112", name: "Emergency", description: "Police, fire, ambulance", verified: false }, // VERIFY
  { number: "182", name: "RPF", description: "Railway Protection Force", verified: false }, // VERIFY
  { number: "139", name: "Railway helpline", description: "Rail Madad", verified: false }, // VERIFY
  { number: "1512", name: "GRP Mumbai", description: "Government Railway Police", verified: false }, // VERIFY
];

/** Short numbers that render as tap-to-call links inside assistant text. */
export const HELPLINE_NUMBERS: ReadonlySet<string> = new Set(HELPLINES.map((h) => h.number));
