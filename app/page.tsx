import Panel from "@/components/Panel";
import SetupForm from "@/components/SetupForm";

// Read STUDY_MODE on every request, not once at build time.
export const dynamic = "force-dynamic";

export default function SetupPage() {
  const studyMode = process.env.STUDY_MODE === "true";

  return (
    <main className="shell setup-shell">
      <p className="eyebrow">Kinematics · Session setup</p>
      <h1 className="page-title">10 questions, then tutoring on the ones you miss</h1>
      <p className="lede">
        Answer each question and say in one line why you chose it. StuckPoint finds the misconception
        behind any mistake, tutors you on that one idea, then checks you on 10 new questions.
      </p>
      <Panel>
        <SetupForm studyMode={studyMode} />
      </Panel>
    </main>
  );
}
