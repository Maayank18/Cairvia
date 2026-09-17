const SECRET_PATTERNS: RegExp[] = [
  /password\s*[=:]\s*\S+/i,
  /api[_-]?key\s*[=:]\s*\S+/i,
  /secret\s*[=:]\s*\S+/i,
  /bearer\s+[a-z0-9\-._~+/]+=*/i,
  /sessionid\s*[=:]\s*\S+/i,
  /cookie:\s*.+/i
];

export function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

export function redactSecrets(text: string): { text: string; redacted: boolean } {
  if (!containsSecret(text)) {
    return { text, redacted: false };
  }
  let next = text;
  for (const pattern of SECRET_PATTERNS) {
    next = next.replace(pattern, "[redacted]");
  }
  return { text: next, redacted: true };
}

export function isMemoryAllowed(kind: string): boolean {
  const blocked = new Set([
    "password",
    "api_key",
    "session_cookie",
    "screen_capture",
    "raw_audio",
    "unrelated_browsing"
  ]);
  return !blocked.has(kind);
}
