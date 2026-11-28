import TestRunner from "@/components/TestRunner";
import { loadTestPage } from "@/lib/test-page";

export const dynamic = "force-dynamic";

/** The retention test: ten new questions on the same ideas, 3 to 4 days after the post-test. */
export default async function RetentionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, questions, initialAnswers } = await loadTestPage(id, "retention");

  return (
    <TestRunner
      sessionId={session.id}
      phase="retention"
      language={session.language}
      studentId={session.student_id}
      questions={questions}
      initialAnswers={initialAnswers}
    />
  );
}
