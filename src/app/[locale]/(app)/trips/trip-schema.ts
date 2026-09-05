import { z } from "zod";
import { requiredId, type FormState } from "@/lib/forms";

/**
 * The entry grid posts every trip for one shift as one JSON tree in a hidden
 * field — same pattern as scorecards' template editor (`parseTemplateDraft`)
 * for the same reason: a free-form list of rows, each with its own nested
 * list, isn't a shape repeated `<input>` names represent well.
 *
 * `clientKey` is a client-generated id used only to match a save result back
 * to its row in the grid — it never reaches the database.
 */

const stopDraft = z.object({
  routeStationId: requiredId,
  direction: z.enum(["outbound", "return"]),
  // an ISO timestamp; Postgres does the real validation on the way in
  departureAt: z
    .string()
    .trim()
    .refine((v) => v !== "" && !Number.isNaN(Date.parse(v)), { message: "required" }),
});

const tripDraft = z.object({
  clientKey: z.string().trim().min(1),
  id: z.string().nullable(),
  routeId: requiredId,
  // a row the user added but never filled in is dropped, not rejected — see
  // saveTrips's draftTrips filter
  stops: z.array(stopDraft),
});

export type TripStopDraft = z.infer<typeof stopDraft>;
export type TripDraft = z.infer<typeof tripDraft>;

const tripsBatchSchema = z.object({
  operationId: requiredId,
  trips: z.array(tripDraft),
});

export type TripsBatchDraft = z.infer<typeof tripsBatchSchema>;

/**
 * The save action's result shape. Defined here rather than in
 * `trip-actions.ts` because that file carries `"use server"`, and such a
 * file may only export async functions — a plain constant like
 * `EMPTY_SAVE_TRIPS_STATE` has to live outside it. Same reason
 * `EMPTY_BULK_PLAN_STATE` lives in `operations/schema.ts`, not
 * `operations/actions.ts`.
 */
export type TripSaveResult = {
  clientKey: string;
  tripId: string | null;
  ok: boolean;
  reason: "duplicate" | "saveFailed" | null;
};

export type SaveTripsState = FormState & { results: TripSaveResult[] | null };

export const EMPTY_SAVE_TRIPS_STATE: SaveTripsState = {
  formError: null,
  fieldErrors: {},
  results: null,
};

export function parseTripsBatch(
  formData: FormData,
):
  | { success: true; data: TripsBatchDraft }
  | { success: false; error: "saveFailed" | "invalidDraft" } {
  const raw = formData.get("draft");
  if (typeof raw !== "string") return { success: false, error: "saveFailed" };

  try {
    const parsed = tripsBatchSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { success: false, error: "invalidDraft" };
    return { success: true, data: parsed.data };
  } catch {
    return { success: false, error: "saveFailed" };
  }
}
