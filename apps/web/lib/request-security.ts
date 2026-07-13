export function isTrustedMutation(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const configuredOrigin = process.env.NODE_ENV === "production" ? process.env.APP_URL : undefined;
    const expectedOrigin = new URL(configuredOrigin || request.url).origin;
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}
