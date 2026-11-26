import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MisconceptionMap, { type MapTile } from "@/components/MisconceptionMap";
import MotionLab from "@/components/MotionLab";
import Panel from "@/components/Panel";
import { getAnswers, getSession, type AnswerRow } from "@/lib/db";
import { questionLabel } from "@/lib/labels";
import { loadPack, retentionAvailable } from "@/lib/pack";
import { countCorrect } from "@/lib/scoring";
import { phaseHref } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Misconception codes shown by wrong answers. Guesses and calculation slips do not count. */
function codesShown(answers: AnswerRow[]): Map<string, string[]> {
  const shown = new Map<string, string[]>();
  for (const a of answers) {
    if (a.correct === 1 || a.guess === 1) continue;
    const code = a.option_tag;
    if (!code || code === "C0") continue;
    shown.set(code, [...(shown.get(code) ?? []), a.qid]);
  }
  return shown;
}

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  if (session.phase !== "results") redirect(phaseHref(session.id, session.phase));

  const pack = loadPack();
  const pre = await getAnswers(session.id, "pretest");
  const post = await getAnswers(session.id, "posttest");
  const preScore = countCorrect(pre);
  const postScore = countCorrect(post);
  const before = codesShown(pre);
  const after = codesShown(post);
  const codes = Object.keys(pack.misconceptions).filter((code) => before.has(code) || after.has(code));
  const slips = [...pre, ...post].filter((a) => a.correct === 0 && a.option_tag === "C0").length;
  const mastery = postScore >= 8;
  const preGuesses = pre.filter((a) => a.guess === 1).length;
  const postGuesses = post.filter((a) => a.guess === 1).length;
  const fixed = codes.filter((c) => before.has(c) && !after.has(c)).length;

  const tiles: MapTile[] = Object.entries(pack.misconceptions).map(([code, m]) => {
    if (before.has(code) && !after.has(code)) return { code, name: m.name, state: "fixed", label: "Fixed" };
    if (before.has(code)) return { code, name: m.name, state: "still", label: "Still showing" };
    if (after.has(code)) return { code, name: m.name, state: "still", label: "Showed after" };
    return { code, name: m.name, state: "clear", label: "Never showed" };
  });

  const qs = (qids: string[] | undefined) => (qids ?? []).map((q) => questionLabel(pack, q)).join(", ");
  const summary =
    postScore > preScore
      ? `Up ${postScore - preScore} on questions you had never seen.`
      : postScore === preScore
        ? "Same score on a new set of questions."
        : "Lower on the new questions, so more practice will help.";

  return (
    <>
      <div className="res">
        <Panel>
          <p className="eyebrow">Step 05 · Results · {session.student_id}</p>
          <div className="delta" aria-label={`Pre-test ${preScore} out of ${pre.length}, post-test ${postScore} out of ${post.length}`}>
            <span className="delta-n is-pre">{preScore}</span>
            <span className="delta-arr" aria-hidden="true">
              →
            </span>
            <span className="delta-n is-post">{postScore}</span>
            <span className="delta-of">/ {post.length}</span>
          </div>
          <div className="delta-l" aria-hidden="true">
            <span>Pre-test · Set A</span>
            <span>Post-test · Set B</span>
          </div>
          <p className="lede">
            {summary}
            {fixed > 0 ? ` ${fixed} ${fixed === 1 ? "misconception" : "misconceptions"} no longer showing.` : ""}
          </p>
          <p className={mastery ? "mastery is-good" : "mastery"}>
            {mastery ? "Mastery: 8 or more on new questions" : "Mastery needs 8 or more on the post-test"}
          </p>
        </Panel>
        <section className="enter" aria-label="Motion lab replay">
          <MotionLab
            h0={45}
            title="Replay · ball dropped from 45 m"
            caption="Speed grows by the same 10 m/s every second, which is why the gaps between circles keep growing."
          />
        </section>
      </div>

      <MisconceptionMap
        tiles={tiles}
        label="Misconception map after tutoring"
        delay={0.3}
        legend={[
          { label: "Fixed", colour: "var(--good)" },
          { label: "Still showing", colour: "var(--bad)" },
          { label: "Never showed", colour: "", outline: true },
        ]}
      />

      {codes.length > 0 ? (
        <div className="rows result-table-wrap">
          <table className="result-table">
            <thead>
              <tr>
                <th scope="col">Misconception</th>
                <th scope="col">Pre-test</th>
                <th scope="col">Post-test</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <tr key={code}>
                  <td>
                    <span className="code">{code}</span>
                    {pack.misconceptions[code].name}
                  </td>
                  <td>
                    {before.has(code) ? (
                      <span className="flag bad">
                        Showing <span className="flag-q">{qs(before.get(code))}</span>
                      </span>
                    ) : (
                      <span className="flag faint">Clear</span>
                    )}
                  </td>
                  <td>
                    {after.has(code) ? (
                      <span className="flag bad">
                        Showing <span className="flag-q">{qs(after.get(code))}</span>
                      </span>
                    ) : (
                      <span className="flag good">Clear</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="lede">No misconceptions showed up in either test.</p>
      )}

      <div className="page-foot">
        <div className="stack">
          {slips > 0 ? (
            <p className="hint">
              {slips} wrong {slips === 1 ? "answer was a calculation slip" : "answers were calculation slips"}, not a
              misconception.
            </p>
          ) : null}
          {preGuesses + postGuesses > 0 ? (
            <p className="hint">
              Not counted as evidence: {preGuesses} pre-test and {postGuesses} post-test{" "}
              {preGuesses + postGuesses === 1 ? "answer" : "answers"} given in under 4 seconds or marked as a guess.
              They still count towards the scores.
            </p>
          ) : null}
          <p className="hint">
            Retention test:{" "}
            {retentionAvailable(pack) ? "take it 3 to 4 days from now." : "not available yet. The question set is still being written."}
          </p>
          <p className="hint">
            One session is early evidence, not proof. Both tests are scored against fixed answers, never by the AI.
          </p>
        </div>
        <div className="form-actions">
          <a className="btn-primary" href={`/api/export?id=${session.id}`}>
            Download session log (CSV)
          </a>
          <Link className="btn-quiet" href="/">
            Start a new session
          </Link>
        </div>
      </div>
    </>
  );
}
