import { z } from "zod";
import {
  optionalId,
  optionalInterval,
  optionalNonNegative,
  readFields,
  requiredText,
} from "@/lib/forms";

export const routeSchema = z.object({
  routeCode: requiredText(60),
  routeName: requiredText(200),
  routeDistanceKm: optionalNonNegative,
  numberOfStations: optionalNonNegative,
  standardLegTime: optionalInterval,
  standardRoundTripTime: optionalInterval,
  statusId: optionalId,
});

export type RouteInput = z.infer<typeof routeSchema>;

export const ROUTE_FIELDS = [
  "routeCode",
  "routeName",
  "routeDistanceKm",
  "numberOfStations",
  "standardLegTime",
  "standardRoundTripTime",
  "statusId",
] as const;

export const parseRouteForm = (formData: FormData) =>
  routeSchema.safeParse(readFields(formData, ROUTE_FIELDS));

/** CSV import/export columns (roadmap: CSV Import/Export). Routes only — the
 * stop list (route_stations) is inherently sequential/relational, a poor fit
 * for flat-row CSV, so it's edited in the route-stations editor as before. */
export const ROUTE_IMPORT_COLUMNS = [
  "route_code",
  "route_name",
  "route_distance_km",
  "number_of_stations",
  "standard_leg_time",
  "standard_round_trip_time",
  "status_code",
] as const;

export const stationSchema = z.object({
  stationCode: requiredText(60),
  stationName: requiredText(200),
  statusId: optionalId,
});

export type StationInput = z.infer<typeof stationSchema>;

export const STATION_FIELDS = ["stationCode", "stationName", "statusId"] as const;

export const parseStationForm = (formData: FormData) =>
  stationSchema.safeParse(readFields(formData, STATION_FIELDS));

/**
 * Every edit to a route's stop list goes through one action, so the editor has
 * a single place to show an error from.
 */
export const routeStationsSchema = z.object({
  intent: z.enum(["add", "moveUp", "moveDown", "remove"], {
    errorMap: () => ({ message: "required" }),
  }),
  stationId: optionalId,
  routeStationId: optionalId,
});

export const ROUTE_STATION_FIELDS = ["intent", "stationId", "routeStationId"] as const;

export const parseRouteStationsForm = (formData: FormData) =>
  routeStationsSchema.safeParse(readFields(formData, ROUTE_STATION_FIELDS));
