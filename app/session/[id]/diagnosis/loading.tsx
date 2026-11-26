import Panel from "@/components/Panel";

/** Shown while the AI reads the pre-test reasons, which can take a few seconds. */
export default function DiagnosisLoading() {
  return (
    <Panel>
      <p className="eyebrow">Step 02 · Diagnosis</p>
      <h1 className="page-title">
        Reading your <em>answers and reasons.</em>
      </h1>
      <p className="lede">
        Matching each answer and one-line reason against 10 known kinematics misconceptions. This can take several
        seconds.
      </p>
      <div className="dx-progress" role="progressbar" aria-label="Diagnosing">
        <span />
      </div>
      <ul className="map ghost-map" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <li key={i} className="tile">
            <span className="tile-code">M{i + 1}</span>
            <span className="tile-name" />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
