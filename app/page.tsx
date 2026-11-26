import MotionLab from "@/components/MotionLab";
import SetupForm from "@/components/SetupForm";

// Read STUDY_MODE on every request, not once at build time.
export const dynamic = "force-dynamic";

export default function SetupPage() {
  const studyMode = process.env.STUDY_MODE === "true";

  return (
    <main className="shell">
      <div className="setup">
        <section className="enter">
          <p className="eyebrow">Kinematics · 10 questions · one line of reasoning each</p>
          <h1 className="display">
            Ten questions. Then we tutor <em>the exact idea</em> you got wrong.
          </h1>
          <p className="lede">
            Answer each question and say why in one line. StuckPoint reads your reasons, pins down the
            misconception behind each mistake, tutors that one idea, and checks it with ten new questions.
          </p>
          <SetupForm studyMode={studyMode} />
        </section>
        <section className="enter" aria-label="Motion lab demonstration">
          {/* A plain drop from 20 m: chosen so it does not answer any test question. */}
          <MotionLab
            h0={20}
            title="Ball dropped from 20 m"
            caption="Each outlined circle marks where the ball was, every 0.2 s. The graphs draw as it falls."
          />
        </section>
      </div>
    </main>
  );
}
