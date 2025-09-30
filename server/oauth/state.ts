export function encodeState(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

export function decodeState<T = any>(s?: string | string[] | null): T | null {
  if (!s || Array.isArray(s)) return null;
  try { return JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as T; }
  catch {
    try { return JSON.parse(Buffer.from(s, "base64").toString("utf8")) as T; }
    catch { return null; }
  }
}
