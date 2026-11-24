import { NextResponse, type NextRequest } from "next/server";
import { buildSessionLog, LOG_COLUMNS, toCsv } from "@/lib/csv";
import { getSession } from "@/lib/db";

export const runtime = "nodejs";

/** Download one session's full log as CSV: GET /api/export?id=<session id> */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: "That session does not exist." }, { status: 404 });

  const csv = toCsv(LOG_COLUMNS, buildSessionLog(id));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stuckpoint-${session.student_id}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
