import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/roles";
import { DATA_VALIDATION_CATEGORIES } from "./schema";

/** Read side of settings. `super_admin` only — the page refuses everyone else. */

/** Which of the three settings groups the page is showing. */
export type SettingsEntity = "users" | "thresholds" | "lookups";

export type UserRow = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  role: AppRole;
  isEngineer: boolean;
  isActive: boolean;
};

export type ThresholdRow = {
  key: string;
  value: number;
  label: string | null;
};

export type LookupRow = {
  id: string;
  category: string;
  categoryLabel: string;
  code: string;
  labelEn: string;
  labelAr: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type LookupCategoryRow = { key: string; label: string };

export async function loadUsers(search: string): Promise<UserRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, job_title, role, is_engineer, is_active")
    .order("full_name");

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`full_name.ilike.${term},job_title.ilike.${term}`);
  }

  const { data } = await query;
  return (data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    jobTitle: p.job_title,
    role: p.role as AppRole,
    isEngineer: p.is_engineer,
    isActive: p.is_active,
  }));
}

export async function loadUser(id: string): Promise<UserRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, job_title, role, is_engineer, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    jobTitle: data.job_title,
    role: data.role as AppRole,
    isEngineer: data.is_engineer,
    isActive: data.is_active,
  };
}

/** The two PM thresholds that v_periodic_maintenance reads. */
export const PM_THRESHOLD_KEYS = ["pm_due_soon_km", "pm_due_now_km"] as const;

export async function loadThresholds(): Promise<ThresholdRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value, label")
    .in("key", [...PM_THRESHOLD_KEYS]);

  return (data ?? []).map((s) => ({
    key: s.key,
    value: Number(s.value),
    label: s.label,
  }));
}

/**
 * Data Validation's category list — restricted to DATA_VALIDATION_CATEGORIES
 * regardless of what's actually in lookup_categories. rfr_stage,
 * generic_status, shift_type and fuel_type never surface through this
 * query, so there's no dropdown option and no crafted `?category=` that
 * can reach them.
 */
export async function loadLookupCategories(): Promise<LookupCategoryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lookup_categories")
    .select("key, label")
    .in("key", [...DATA_VALIDATION_CATEGORIES])
    .order("key");
  return (data ?? []).map((c) => ({ key: c.key, label: c.label }));
}

export async function loadAllLookups(category: string): Promise<LookupRow[]> {
  const supabase = await createClient();
  const categories = await loadLookupCategories();
  const labels = new Map(categories.map((c) => [c.key, c.label]));

  let query = supabase
    .from("lookups")
    .select("id, category, code, label_en, label_ar, sort_order, is_active")
    // Same restriction as loadLookupCategories — a stray ?category=rfr_stage
    // in the URL still can't pull structural rows into this view.
    .in("category", [...DATA_VALIDATION_CATEGORIES])
    .order("category")
    .order("sort_order");

  if (category) query = query.eq("category", category);

  const { data } = await query;
  return (data ?? []).map((l) => ({
    id: l.id,
    category: l.category,
    categoryLabel: labels.get(l.category) ?? l.category,
    code: l.code,
    labelEn: l.label_en,
    labelAr: l.label_ar,
    sortOrder: l.sort_order,
    isActive: l.is_active,
  }));
}

export async function loadLookup(id: string): Promise<LookupRow | null> {
  const rows = await loadAllLookups("");
  return rows.find((r) => r.id === id) ?? null;
}
