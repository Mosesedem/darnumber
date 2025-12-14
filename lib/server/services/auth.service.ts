import { prisma } from "@/lib/server/prisma";
import bcrypt from "bcryptjs";

export type SafeUser = {
  id: string;
  email: string;
  userName?: string | null;
  role?: string | null;
};

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(params: {
  email: string;
  password: string;
  userName: string;
  name?: string | null;
  phone?: string | null;
  country?: string | null;
  referralCode?: string | null;
}) {
  const { email, password, userName, name, phone, country, referralCode } =
    params;
  const existing = await findUserByEmail(email);
  if (existing) throw new Error("Email already in use");
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hash,
      userName,
      name,
      phone,
      country,
      referredBy: referralCode ?? undefined,
    },
  });
  return toSafeUser(user);
}

export async function verifyUserCredentials(
  identifier: string,
  password: string
) {
  // Try to find user by email, username, or phone
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { userName: identifier },
        { phone: identifier },
      ],
    },
  });
  if (!user || !user.password) return null;
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;
  return toSafeUser(user);
}

export function toSafeUser(u: any): SafeUser {
  return {
    id: String(u.id),
    email: u.email,
    userName: u.userName ?? null,
    role: u.role ?? null,
  };
}
