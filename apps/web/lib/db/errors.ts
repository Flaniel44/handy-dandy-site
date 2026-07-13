export function hasDatabaseErrorCode(error: unknown, code: string) {
  let current = error;
  while (typeof current === "object" && current !== null) {
    if ("code" in current && current.code === code) return true;
    if (!("cause" in current)) return false;
    current = current.cause;
  }
  return false;
}
