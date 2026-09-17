import { describe, expect, it } from "vitest";
import {
  auditSk,
  commitmentSk,
  openIndexPk,
  snapSk,
  threadSk,
  userPk
} from "./keys.js";

describe("DynamoDB access keys", () => {
  it("scopes every item to the user partition", () => {
    expect(userPk("u1")).toBe("USER#u1");
    expect(threadSk("thr_1")).toBe("THREAD#thr_1");
    expect(snapSk("thr_1", "2026-09-17T10:00:00.000Z", "snap_1")).toContain(
      "SNAP#thr_1#"
    );
    expect(commitmentSk("cmt_1")).toBe("CMT#cmt_1");
    expect(auditSk("2026-09-17T10:00:00.000Z", "evt_1")).toContain("AUDIT#");
    expect(openIndexPk("u1")).toBe("USER#u1#OPEN");
  });
});
