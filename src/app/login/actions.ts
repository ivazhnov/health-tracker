"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";

export async function loginAction(formData: FormData) {
  const password = formData.get("password");

  if (
    typeof password !== "string" ||
    !verifyPassword(password, requiredPasswordHash())
  ) {
    redirect("/login?error=wrong_password");
  }

  await createSession();
  redirect("/");
}

function requiredPasswordHash() {
  const value = process.env.APP_PASSWORD_HASH;

  if (!value) {
    throw new Error("APP_PASSWORD_HASH is required");
  }

  return value;
}
