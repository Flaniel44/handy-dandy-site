import { getSession } from "../../../../lib/admin-auth";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ user: null });
  return Response.json({ user: session.role === "admin" ? { role: "admin", firstName: "Admin" } : { role: "customer", firstName: session.firstName } });
}
