import { NextResponse } from "next/server";
import { z } from "zod";
import { pinToken, TEACHER_COOKIE, teacherPin } from "@/lib/teacher";

export const runtime = "nodejs";

const Body = z.object({ pin: z.string().min(1).max(64) });

/** Check the teacher PIN and, if right, set a cookie for 12 hours. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  const pin = teacherPin();
  if (!pin) return NextResponse.json({ error: "Set TEACHER_PIN in the settings to use the teacher view." }, { status: 503 });
  if (!parsed.success || parsed.data.pin !== pin) {
    // A short pause makes guessing PINs slow.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "That PIN is not right." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEACHER_COOKIE, pinToken(pin), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
