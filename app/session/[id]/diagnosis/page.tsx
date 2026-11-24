import { notFound, redirect } from "next/navigation";
import Panel from "@/components/Panel";
import PhaseButton from "@/components/PhaseButton";
import { countCorrect } from "@/lib/scoring";
import { getAnswers, getSession } from "@/lib/db";
import { phaseHref } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Milestone 1 placeholder. The AI diagnosis (milestone 2) will replace the body of this page.
 * For now it shows the pre-test score and lets the student continue to the post-test,
 * so the whole flow can be tested end to end.
 */
export default async function DiagnosisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) notFound();
  if (session.phase !== "diagnosis") redirect(phaseHref(session.id, session.phase));

  const answers = getAnswers(session.id, "pretest");
  const score = countCorrect(answers);
  const guesses = answers.filter((a) => a.guess === 1).length;

  // Study mode control group: same tests, but they study with ChatGPT Study Mode instead of StuckPoint.
  if (session.study_group === "control") {
    return (
      <Panel>
        <p className="eyebrow">Study · Your next step</p>
        <h1 className="page-title">Study kinematics for 20 minutes, then come back</h1>
        <p className="lede">
          Open ChatGPT, turn on Study Mode, and work on kinematics for 20 minutes: motion graphs,
          velocity and acceleration, falling objects and projectiles. Then return here and take the
          post-test with the same student ID, <span className="mono">{session.student_id}</span>.
        </p>
        <PhaseButton sessionId={session.id} to="posttest">
          I have finished studying, start the post-test
        </PhaseButton>
      </Panel>
    );
  }

  return (
    <Panel>
      <p className="eyebrow">Step 02 · Diagnosis</p>
      <h1 className="page-title">
        Pre-test done: {score} of {answers.length}
      </h1>
      <p className="lede">
        Your answers and reasons are saved. The AI diagnosis that finds the exact misconception behind
        each mistake is being built next. For now, continue to the post-test.
      </p>
      {guesses > 0 ? (
        <p className="hint">
          {guesses} {guesses === 1 ? "answer was" : "answers were"} marked as a guess and will not count as
          evidence of a misconception.
        </p>
      ) : null}
      <div className="stack" style={{ marginTop: 18 }}>
        <PhaseButton sessionId={session.id} to="posttest">
          Continue to the post-test
        </PhaseButton>
      </div>
    </Panel>
  );
}
