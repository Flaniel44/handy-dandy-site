export function publicUrl(request: Request, path: string) {
  const configuredUrl = process.env.NODE_ENV === "production"
    ? process.env.APP_URL?.trim()
    : undefined;
  return new URL(path, configuredUrl || request.url);
}
