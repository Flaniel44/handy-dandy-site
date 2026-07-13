import { createHash, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../../../../lib/db";
import { customers, passwordResetTokens } from "../../../../lib/db/schema";
import { sendPasswordResetEmail } from "../../../../lib/email";

const schema = z.object({ email: z.email().transform((value) => value.trim().toLowerCase()) });
const genericMessage = "If an account exists for that email, a reset link is on its way.";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: genericMessage });

  const db = getDb();
  const [customer] = await db.select().from(customers).where(eq(customers.email, parsed.data.email)).limit(1);
  if (!customer?.passwordHash) return Response.json({ message: genericMessage });

  const [latest] = await db.select({ createdAt: passwordResetTokens.createdAt }).from(passwordResetTokens)
    .where(eq(passwordResetTokens.customerId, customer.id)).orderBy(desc(passwordResetTokens.createdAt)).limit(1);
  if (latest && Date.now() - latest.createdAt.getTime() < 60_000) return Response.json({ message: genericMessage });

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResetTokens).values({
    customerId: customer.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  try {
    await sendPasswordResetEmail(customer.email, customer.firstName || customer.name.split(" ")[0], token);
  } catch (error) {
    console.error("Unable to send password reset email", error);
  }
  return Response.json({ message: genericMessage });
}

function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
