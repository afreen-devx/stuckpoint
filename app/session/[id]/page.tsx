import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/db";
import { phaseHref } from "@/lib/session";

export const dynamic = "force-dynamic";

/** /session/<id> always sends the student to the step their session is on. */
export default async function SessionIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  redirect(phaseHref(session.id, session.phase));
}
