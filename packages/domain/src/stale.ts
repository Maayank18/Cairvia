import type { RecoveryCapsuleV1 } from "@cairvia/schemas";

export type CapsuleFreshness = "FRESH" | "AGING" | "STALE";

export function capsuleFreshness(
  capsule: RecoveryCapsuleV1,
  now: Date = new Date()
): CapsuleFreshness {
  const captured = Date.parse(capsule.capturedAt);
  const staleMs = capsule.staleAfterMinutes * 60 * 1000;
  const age = now.getTime() - captured;
  if (age > staleMs) {
    return "STALE";
  }
  if (age > staleMs * 0.5) {
    return "AGING";
  }
  return "FRESH";
}

export function isCapsuleStale(
  capsule: RecoveryCapsuleV1,
  now: Date = new Date()
): boolean {
  return capsuleFreshness(capsule, now) === "STALE";
}

export function isTimestampStale(
  lastValidatedAt: string,
  staleAfterMinutes: number,
  now: Date = new Date()
): boolean {
  const last = Date.parse(lastValidatedAt);
  return now.getTime() > last + staleAfterMinutes * 60 * 1000;
}
