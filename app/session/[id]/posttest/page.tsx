import TestRunner from "@/components/TestRunner";
import { loadTestPage } from "@/lib/test-page";

export const dynamic = "force-dynamic";

export default async function PosttestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, questions, initialAnswers } = await loadTestPage(id, "posttest");

  return (
    <TestRunner
      sessionId={session.id}
      phase="posttest"
      language={session.language}
      studentId={session.student_id}
      questions={questions}
      initialAnswers={initialAnswers}
    />
  );
}
