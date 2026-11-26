import TestRunner from "@/components/TestRunner";
import { loadTestPage } from "@/lib/test-page";

export const dynamic = "force-dynamic";

export default async function PretestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, questions, initialAnswers } = await loadTestPage(id, "pretest");

  return (
    <TestRunner
      sessionId={session.id}
      phase="pretest"
      language={session.language}
      studentId={session.student_id}
      questions={questions}
      initialAnswers={initialAnswers}
    />
  );
}
