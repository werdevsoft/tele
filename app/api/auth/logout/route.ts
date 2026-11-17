import { NextResponse } from "next/server";
import { COOKIE, route } from "@/lib/api";

export const POST = route(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}, { public: true });
