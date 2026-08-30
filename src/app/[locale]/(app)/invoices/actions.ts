"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { isSuper, requireUser } from "@/lib/auth";
import {
  dbErrorToState,
  readFields,
  requiredId,
  type DbError,
  type FormState,
} from "@/lib/forms";

/**
 * Invoice mutations. `super_admin` only, matching RLS.
 *
 * The arithmetic lives entirely in fn_generate_invoice — rate, bus quantity,
 * gross, achieved percentage and net are all written by the function. This
 * module calls it and translates what it raises.
 */

type Guard = { locale: string } | FormState;
const denied = (g: Guard): g is FormState => "formError" in g;

async function guardSuper(): Promise<Guard> {
  const locale = await getLocale();
  const user = await requireUser(locale);
  if (!isSuper(user.role)) return { formError: "forbidden", fieldErrors: {} };
  return { locale };
}

const refresh = () => revalidatePath("/[locale]/invoices", "page");

const generateSchema = z.object({
  vendorId: requiredId,
  shiftTypeId: requiredId,
  month: z
    .string()
    .trim()
    .refine((v) => /^\d{4}-\d{2}$/.test(v), { message: "required" })
    .transform((v) => `${v}-01`),
});

/** The function raises for both missing terms and a missing scorecard. */
function raiseToKey(e: DbError): string {
  const text = `${e.message ?? ""} ${e.details ?? ""}`;
  if (text.includes("no billing terms")) return "noBillingTerms";
  if (text.includes("No scorecard")) return "noScorecard";
  return "generateFailed";
}

export async function generateInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const parsed = generateSchema.safeParse(
    readFields(formData, ["vendorId", "shiftTypeId", "month"] as const),
  );
  if (!parsed.success) {
    return { formError: null, fieldErrors: { month: "required" } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_generate_invoice", {
    p_vendor_id: parsed.data.vendorId,
    p_month: parsed.data.month,
    p_shift_type_id: parsed.data.shiftTypeId,
  });

  if (error) {
    if (error.code === "P0001") {
      return { formError: raiseToKey(error), fieldErrors: {} };
    }
    return dbErrorToState(error);
  }

  refresh();
  return redirect({
    href: { pathname: "/invoices", query: { id: String(data) } },
    locale: gate.locale,
  });
}

const STATUSES = ["draft", "submitted", "approved", "paid"] as const;

const statusSchema = z.object({
  status: z.enum(STATUSES, { errorMap: () => ({ message: "required" }) }),
});

export async function setInvoiceStatus(
  invoiceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const parsed = statusSchema.safeParse(readFields(formData, ["status"] as const));
  if (!parsed.success) return { formError: "saveFailed", fieldErrors: {} };

  const supabase = await createClient();
  const { error } = await supabase
    .from("vendor_invoices")
    .update({ status: parsed.data.status })
    .eq("id", invoiceId);

  if (error) return dbErrorToState(error);

  refresh();
  return { formError: null, fieldErrors: {} };
}
