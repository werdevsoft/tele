import { NextResponse } from "next/server";
import { COOKIE, route, HttpError } from "@/lib/api";
import { makeToken, passwordOk } from "@/lib/crypto";

export const POST = route(async (req) => {
  const { password } = await req.json();
  if (!process.env.APP_PASSWORD) throw new HttpError(500, "APP_PASSWORD is not set on the server");
  if (!passwordOk(String(password ?? ""))) {
    await new Promise((r) => setTimeout(r, 800));     // slow down guessing
    throw new HttpError(401, "Wrong password");
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, makeToken(30), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
  return res;
}, { public: true });
