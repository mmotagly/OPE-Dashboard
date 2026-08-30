import { describe, expect, it } from "vitest";
import { canTransition } from "./stage-rules";

/**
 * Mirrors the transition graph in fn_validate_rfr_stage_transition
 * (supabase/migrations/0004_rfr_stage_transitions.sql) exactly — see the
 * comment on canTransition. If the graph in stage-rules.ts changes without
 * the SQL trigger changing too (or vice versa), these tests catch the
 * TS-side symptom, but they cannot see the SQL side; keep both in sync by
 * hand as the module comment already says.
 */

const ALL_STAGES = [
  "pending",
  "active",
  "skipped_next_trip",
  "skipped_next_pm",
  "skipped",
  "rolled_over",
  "completed",
] as const;

const ALLOWED: Record<string, readonly string[]> = {
  pending: ["active", "skipped_next_trip", "skipped_next_pm", "skipped"],
  active: ["skipped_next_trip", "skipped_next_pm", "skipped", "rolled_over", "completed"],
  skipped_next_trip: ["active"],
  skipped_next_pm: ["active"],
  skipped: ["active"],
  rolled_over: ["active"],
  completed: [],
};

describe("canTransition (non-super-admin)", () => {
  for (const from of ALL_STAGES) {
    for (const to of ALL_STAGES) {
      const expected = from !== to && (ALLOWED[from]?.includes(to) ?? false);
      it(`${from} -> ${to} is ${expected ? "allowed" : "rejected"}`, () => {
        expect(canTransition(from, to, false)).toBe(expected);
      });
    }
  }

  it("completed is terminal — no outgoing transition at all", () => {
    for (const to of ALL_STAGES) {
      expect(canTransition("completed", to, false)).toBe(false);
    }
  });

  it("rejects an unknown source stage", () => {
    expect(canTransition("not_a_real_stage", "active", false)).toBe(false);
  });

  it("rejects a transition to an unknown target stage", () => {
    expect(canTransition("pending", "not_a_real_stage", false)).toBe(false);
  });
});

describe("canTransition (super_admin)", () => {
  it("bypasses the graph for every stage pair, including from completed", () => {
    for (const from of ALL_STAGES) {
      for (const to of ALL_STAGES) {
        if (from === to) continue;
        expect(canTransition(from, to, true)).toBe(true);
      }
    }
  });

  it("still rejects a no-op transition to the same stage", () => {
    for (const stage of ALL_STAGES) {
      expect(canTransition(stage, stage, true)).toBe(false);
    }
  });
});
