import { describe, expect, it } from "vitest";
import { buildOperationSchema } from "./schema";

/**
 * Mirrors fn_validate_operation_status (0009/0010/0011/0013) and
 * fn_validate_operation_status_locked (0012) — see the module comment on
 * buildOperationSchema. These tests exercise the zod mirror only; they
 * cannot see the SQL trigger, so keep both in sync by hand as the source
 * comment already says.
 */

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";
const UUID_C = "33333333-3333-3333-3333-333333333333";

const STATUS_IDS = {
  planned: "aaaaaaaa-0000-0000-0000-000000000000",
  operating: "bbbbbbbb-0000-0000-0000-000000000000",
  completed: "cccccccc-0000-0000-0000-000000000000",
  cancelled_by_vendor: "dddddddd-0000-0000-0000-000000000000",
  under_maintenance: "eeeeeeee-0000-0000-0000-000000000000",
} as const;

const statusCodeById = Object.fromEntries(
  Object.entries(STATUS_IDS).map(([code, id]) => [id, code]),
);

const base = {
  operationDate: "2026-08-30",
  shiftTypeId: UUID_A,
  vehicleId: UUID_B,
  routeId: "",
  driverId: "",
  startingKm: "",
  endingKm: "",
  operatingPct: "",
  startingBatteryPct: "",
  endingBatteryPct: "",
  driverTips: "",
  remarks: "",
};

const schema = buildOperationSchema(statusCodeById);

const errorsByField = (result: ReturnType<typeof schema.safeParse>) => {
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in out)) out[field] = issue.message;
  }
  return out;
};

describe("operating status", () => {
  it("accepts driver + starting KM + starting battery, nothing else", () => {
    const result = schema.safeParse({
      ...base,
      statusId: STATUS_IDS.operating,
      driverId: UUID_C,
      startingKm: "100",
      startingBatteryPct: "80",
    });
    expect(result.success).toBe(true);
  });

  it("requires driverId", () => {
    const result = schema.safeParse({
      ...base,
      statusId: STATUS_IDS.operating,
      startingKm: "100",
      startingBatteryPct: "80",
    });
    expect(errorsByField(result).driverId).toBe("required");
  });

  it("requires startingKm and startingBatteryPct", () => {
    const result = schema.safeParse({
      ...base,
      statusId: STATUS_IDS.operating,
      driverId: UUID_C,
    });
    const errors = errorsByField(result);
    expect(errors.startingKm).toBe("required");
    expect(errors.startingBatteryPct).toBe("required");
  });

  it("forbids endingKm and endingBatteryPct", () => {
    const result = schema.safeParse({
      ...base,
      statusId: STATUS_IDS.operating,
      driverId: UUID_C,
      startingKm: "100",
      startingBatteryPct: "80",
      endingKm: "150",
      endingBatteryPct: "70",
    });
    const errors = errorsByField(result);
    expect(errors.endingKm).toBe("notAllowedForStatus");
    expect(errors.endingBatteryPct).toBe("notAllowedForStatus");
  });
});

describe("completed status", () => {
  const valid = {
    ...base,
    statusId: STATUS_IDS.completed,
    driverId: UUID_C,
    startingKm: "100",
    endingKm: "150",
    startingBatteryPct: "80",
    endingBatteryPct: "60",
    operatingPct: "95",
  };

  it("accepts every field present", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("requires operatingPct (0013)", () => {
    const result = schema.safeParse({ ...valid, operatingPct: "" });
    expect(errorsByField(result).operatingPct).toBe("required");
  });

  it("requires endingKm and endingBatteryPct (0011)", () => {
    const result = schema.safeParse({ ...valid, endingKm: "", endingBatteryPct: "" });
    const errors = errorsByField(result);
    expect(errors.endingKm).toBe("required");
    expect(errors.endingBatteryPct).toBe("required");
  });

  it("rejects endingKm below startingKm", () => {
    const result = schema.safeParse({ ...valid, startingKm: "200", endingKm: "150" });
    expect(errorsByField(result).endingKm).toBe("endBeforeStart");
  });

  it("accepts endingKm equal to startingKm (zero-distance shift)", () => {
    const result = schema.safeParse({ ...valid, startingKm: "150", endingKm: "150" });
    expect(result.success).toBe(true);
  });
});

describe("no-data statuses (planned / cancelled_by_* / under_maintenance)", () => {
  for (const code of ["planned", "cancelled_by_vendor", "under_maintenance"] as const) {
    it(`${code}: accepts every operational field empty`, () => {
      const result = schema.safeParse({ ...base, statusId: STATUS_IDS[code] });
      expect(result.success).toBe(true);
    });

    it(`${code}: forbids driverId and startingKm being set`, () => {
      const result = schema.safeParse({
        ...base,
        statusId: STATUS_IDS[code],
        driverId: UUID_C,
        startingKm: "100",
      });
      const errors = errorsByField(result);
      expect(errors.driverId).toBe("notAllowedForStatus");
      expect(errors.startingKm).toBe("notAllowedForStatus");
    });
  }
});

describe("field-level bounds, independent of status", () => {
  it("rejects a negative startingKm", () => {
    const result = schema.safeParse({
      ...base,
      statusId: STATUS_IDS.operating,
      driverId: UUID_C,
      startingKm: "-5",
      startingBatteryPct: "80",
    });
    expect(errorsByField(result).startingKm).toBe("negative");
  });

  it("rejects an operatingPct over 100", () => {
    const result = schema.safeParse({
      ...base,
      statusId: STATUS_IDS.completed,
      driverId: UUID_C,
      startingKm: "100",
      endingKm: "150",
      startingBatteryPct: "80",
      endingBatteryPct: "60",
      operatingPct: "150",
    });
    expect(errorsByField(result).operatingPct).toBe("percent");
  });

  it("rejects a missing operationDate / shiftTypeId / vehicleId / statusId", () => {
    const result = schema.safeParse({
      ...base,
      operationDate: "",
      shiftTypeId: "",
      vehicleId: "",
      statusId: "",
    });
    const errors = errorsByField(result);
    expect(errors.operationDate).toBe("required");
    expect(errors.shiftTypeId).toBe("required");
    expect(errors.vehicleId).toBe("required");
    expect(errors.statusId).toBe("required");
  });
});
