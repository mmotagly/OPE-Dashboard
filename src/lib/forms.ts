import { z } from "zod";

/**
 * Shared form plumbing. Every module's create/edit form is the same shape:
 * FormData in, zod at the boundary, a `FormState` back with next-intl message
 * keys rather than prose — the schema runs on the server where there is no
 * locale, so the form does the translating.
 *
 * Client-safe on purpose: several Client Components (e.g.
 * settings-forms.tsx) import `FormState`/`EMPTY_FORM_STATE` from here, so
 * this module must never import anything that reaches `next/headers` (no
 * `@/lib/auth`, no `next-intl/server`) — see `lib/action-guard.ts` for the
 * server-only counterpart that does.
 */

export type FormState = {
  /** Message key, or null. */
  formError: string | null;
  /** Field name -> message key. */
  fieldErrors: Record<string, string>;
  /**
   * Interpolation values for `formError`, when the message has to name
   * something the database told us — the session a plug clash collided with,
   * say. Server-side text is never assembled here; only the values are.
   */
  formErrorValues?: Record<string, string>;
};

export const EMPTY_FORM_STATE: FormState = { formError: null, fieldErrors: {} };

/* ---- message keys the field builders below emit ---- */

export const REQUIRED = "required";
export const NOT_A_NUMBER = "number";
export const NEGATIVE = "negative";
export const PERCENT = "percent";
export const BAD_EMAIL = "email";
export const BAD_INTERVAL = "interval";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const requiredId = z
  .string()
  .trim()
  .refine((v) => UUID.test(v), { message: REQUIRED });

export const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || UUID.test(v), { message: REQUIRED });

export const requiredText = (max = 200) =>
  z.string().trim().min(1, { message: REQUIRED }).max(max);

export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const isoDate = z
  .string()
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), {
    message: REQUIRED,
  });

export const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine(
    (v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))),
    { message: REQUIRED },
  );

export const requiredNumber = z
  .string()
  .trim()
  .min(1, { message: REQUIRED })
  .refine((v) => Number.isFinite(Number(v)), { message: NOT_A_NUMBER })
  .transform(Number);

export const optionalNumber = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || Number.isFinite(Number(v)), { message: NOT_A_NUMBER })
  .transform((v) => (v === null ? null : Number(v)));

export const nonNegative = requiredNumber.refine((n) => n >= 0, {
  message: NEGATIVE,
});

export const optionalNonNegative = optionalNumber.refine(
  (n) => n === null || n >= 0,
  { message: NEGATIVE },
);

export const optionalPercent = optionalNumber.refine(
  (n) => n === null || (n >= 0 && n <= 100),
  { message: PERCENT },
);

export const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: BAD_EMAIL,
  });

/** Postgres `interval`, entered as HH:MM or HH:MM:SS. Postgres does the parsing. */
export const optionalInterval = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^\d{1,3}:[0-5]\d(:[0-5]\d)?$/.test(v), {
    message: BAD_INTERVAL,
  });

/** An unchecked HTML checkbox posts nothing at all. */
export const checkbox = z
  .string()
  .trim()
  .transform((v) => v === "on" || v === "true" || v === "1");

/** First message per field — a form only has room for one. */
export function firstFieldErrors(error: z.ZodError<unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in out)) out[field] = issue.message;
  }
  return out;
}

/** Reads every named field off a FormData as a plain string. */
export function readFields<T extends readonly string[]>(
  formData: FormData,
  fields: T,
): Record<T[number], string> {
  const out = {} as Record<T[number], string>;
  for (const field of fields) {
    const value = formData.get(field);
    out[field as T[number]] = typeof value === "string" ? value : "";
  }
  return out;
}

/* ---- database errors ---- */

export type DbError = {
  code?: string;
  message?: string;
  details?: string | null;
};

export const UNIQUE_VIOLATION = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";
export const CHECK_VIOLATION = "23514";
export const RLS_VIOLATION = "42501";

export const dbErrorText = (e: DbError) => `${e.message ?? ""} ${e.details ?? ""}`;

/**
 * Turns a PostgREST error into a form state. `uniqueFields` maps a constraint
 * or column name to the field that should carry the message, so a duplicate
 * code lands on the code input rather than at the top of the form.
 */
export function dbErrorToState(
  e: DbError,
  uniqueFields: Record<string, string> = {},
): FormState {
  const text = dbErrorText(e);

  if (e.code === UNIQUE_VIOLATION) {
    for (const [needle, field] of Object.entries(uniqueFields)) {
      if (text.includes(needle)) {
        return { formError: null, fieldErrors: { [field]: "duplicate" } };
      }
    }
    return { formError: "duplicate", fieldErrors: {} };
  }

  if (e.code === RLS_VIOLATION) return { formError: "forbidden", fieldErrors: {} };
  if (e.code === FOREIGN_KEY_VIOLATION) {
    return { formError: "stillReferenced", fieldErrors: {} };
  }

  return { formError: "saveFailed", fieldErrors: {} };
}
