import { publicUrl } from "./public-url";

export function isTrustedMutation(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const expectedOrigin = publicUrl(request, "/").origin;
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}
