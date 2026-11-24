import Panel from "@/components/Panel";

/** Shown while the AI reads the pre-test reasons, which can take a few seconds. */
export default function DiagnosisLoading() {
  return (
    <Panel>
      <p className="eyebrow">Step 02 · Diagnosis</p>
      <h1 className="page-title">Reading your answers and reasons</h1>
      <p className="lede">
        Matching each answer and one-line reason against 10 known kinematics misconceptions. This can take
        several seconds.
      </p>
      <div className="dx-progress" role="progressbar" aria-label="Diagnosing">
        <span />
      </div>
    </Panel>
  );
}
