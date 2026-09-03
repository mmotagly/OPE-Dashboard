"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { isSuper } from "@/lib/auth";
import { deniedAction, makeActionGuard } from "@/lib/action-guard";
import { dbErrorToState, firstFieldErrors, type FormState } from "@/lib/forms";
import { parseLookupForm, parseThresholdsForm, parseUserForm } from "./schema";

/** Settings is `super_admin` only, the whole page and every action on it. */

const guardSuper = makeActionGuard(isSuper);
const denied = deniedAction;

const refresh = () => revalidatePath("/[locale]/settings", "page");

/** Edits an existing profile. Accounts themselves are created in Supabase. */
export async function updateUser(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const parsed = parseUserForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      job_title: parsed.data.jobTitle,
      role: parsed.data.role,
      // "Engineer" is a job title, not a role — this flag is what makes a
      // profile assignable on a work order.
      is_engineer: parsed.data.isEngineer,
      is_active: parsed.data.isActive,
    })
    .eq("id", id);

  if (error) return dbErrorToState(error);

  refresh();
  return redirect({
    href: { pathname: "/settings", query: { id } },
    locale: gate.locale,
  });
}

/** Both thresholds at once — v_periodic_maintenance reads them as a pair. */
export async function updateThresholds(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const parsed = parseThresholdsForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  for (const key of ["pm_due_soon_km", "pm_due_now_km"] as const) {
    const { error } = await supabase
      .from("app_settings")
      .update({ value: parsed.data[key] })
      .eq("key", key);

    if (error) return dbErrorToState(error);
  }

  refresh();
  revalidatePath("/[locale]/periodic-maintenance", "page");
  return { formError: null, fieldErrors: {} };
}

const LOOKUP_UNIQUE = { lookups_category_code_key: "code" };

export async function createLookup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const parsed = parseLookupForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lookups")
    .insert({
      category: parsed.data.category,
      code: parsed.data.code,
      label_en: parsed.data.labelEn,
      label_ar: parsed.data.labelAr,
      sort_order: parsed.data.sortOrder,
      is_active: parsed.data.isActive,
    })
    .select("id")
    .single();

  if (error) return dbErrorToState(error, LOOKUP_UNIQUE);

  refresh();
  return redirect({
    href: {
      pathname: "/settings",
      query: { entity: "lookups", category: parsed.data.category, id: data.id },
    },
    locale: gate.locale,
  });
}

/**
 * Renames, reorders and deactivates. A value already referenced by
 * operational rows can't be deleted (see deleteLookup below), so
 * `is_active` is what retires it instead.
 */
export async function updateLookup(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const parsed = parseLookupForm(formData);
  if (!parsed.success) {
    return { formError: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("lookups")
    .update({
      code: parsed.data.code,
      label_en: parsed.data.labelEn,
      label_ar: parsed.data.labelAr,
      sort_order: parsed.data.sortOrder,
      is_active: parsed.data.isActive,
    })
    .eq("id", id);

  if (error) return dbErrorToState(error, LOOKUP_UNIQUE);

  refresh();
  return redirect({
    href: {
      pathname: "/settings",
      query: { entity: "lookups", category: parsed.data.category, id },
    },
    locale: gate.locale,
  });
}

/**
 * Deletes a value outright rather than deactivating it. Safe only because
 * nothing pre-checks references — every FK into lookups(id) has no ON
 * DELETE clause, so Postgres itself refuses the delete if anything still
 * points at this row, and dbErrorToState already maps that FK violation to
 * "stillReferenced". A value with zero references just deletes cleanly.
 */
export async function deleteLookup(
  id: string,
  category: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const gate = await guardSuper();
  if (denied(gate)) return gate;

  const supabase = await createClient();
  const { error } = await supabase.from("lookups").delete().eq("id", id);

  if (error) return dbErrorToState(error);

  refresh();
  return redirect({
    href: { pathname: "/settings", query: { entity: "lookups", category } },
    locale: gate.locale,
  });
}
