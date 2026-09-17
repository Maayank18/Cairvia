import type { RecoveryCapsuleV1 } from "@cairvia/schemas";

export function isCapsuleStale(
  capsule: RecoveryCapsuleV1,
  now: Date = new Date()
): boolean {
  const captured = Date.parse(capsule.capturedAt);
  const staleMs = capsule.staleAfterMinutes * 60 * 1000;
  return now.getTime() > captured + staleMs;
}

export function isTimestampStale(
  lastValidatedAt: string,
  staleAfterMinutes: number,
  now: Date = new Date()
): boolean {
  const last = Date.parse(lastValidatedAt);
  return now.getTime() > last + staleAfterMinutes * 60 * 1000;
}
