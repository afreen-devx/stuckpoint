import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Panel from "@/components/Panel";
import { getAnswers, getSession, type AnswerRow } from "@/lib/db";
import { loadPack, retentionAvailable } from "@/lib/pack";
import { countCorrect } from "@/lib/scoring";
import { phaseHref } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Misconception codes shown by wrong answers. Guesses do not count as evidence. */
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
  const session = getSession(id);
  if (!session) notFound();
  if (session.phase !== "results") redirect(phaseHref(session.id, session.phase));

  const pack = loadPack();
  const pre = getAnswers(session.id, "pretest");
  const post = getAnswers(session.id, "posttest");
  const preScore = countCorrect(pre);
  const postScore = countCorrect(post);
  const before = codesShown(pre);
  const after = codesShown(post);
  const codes = Object.keys(pack.misconceptions).filter((code) => before.has(code) || after.has(code));
  const slips = [...pre, ...post].filter((a) => a.correct === 0 && a.option_tag === "C0").length;
  const mastery = postScore >= 8;
  const preGuesses = pre.filter((a) => a.guess === 1).length;
  const postGuesses = post.filter((a) => a.guess === 1).length;

  return (
    <Panel>
      <p className="eyebrow">Step 05 · Results · {session.student_id}</p>
      <h1 className="page-title">
        {postScore > preScore
          ? `Up ${postScore - preScore} on questions you had never seen`
          : postScore === preScore
            ? "Same score on a new set of questions"
            : "Lower on the new questions, so more practice will help"}
      </h1>

      <div className="score-row">
        <dl className="score-card">
          <dt>Pre-test · Set A</dt>
          <dd>
            {preScore}
            <span className="of"> / {pre.length}</span>
          </dd>
        </dl>
        <dl className="score-card">
          <dt>Post-test · Set B</dt>
          <dd>
            {postScore}
            <span className="of"> / {post.length}</span>
          </dd>
        </dl>
      </div>

      <p className={mastery ? "result-flag is-good" : "result-flag"}>
        {mastery ? "Mastery achieved: 8 or more on the post-test." : "Mastery needs 8 or more on the post-test."}
      </p>

      {codes.length > 0 ? (
        <div className="result-table-wrap">
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
                    <span className="mono">{code}</span> {pack.misconceptions[code].name}
                  </td>
                  <td>{before.has(code) ? <span className="flag bad">Showing ({before.get(code)!.join(", ")})</span> : <span className="flag good">Clear</span>}</td>
                  <td>{after.has(code) ? <span className="flag bad">Showing ({after.get(code)!.join(", ")})</span> : <span className="flag good">Clear</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="lede">No misconceptions showed up in either test.</p>
      )}

      <div className="stack" style={{ marginTop: 16 }}>
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
        <p className="hint">One session is early evidence, not proof. Pre- and post-tests are scored against fixed answers, never by the AI.</p>
      </div>

      <div className="form-actions" style={{ marginTop: 20 }}>
        <a className="btn-primary" href={`/api/export?id=${session.id}`}>
          Download session log (CSV)
        </a>
        <Link className="btn-quiet" href="/">
          Start a new session
        </Link>
      </div>
    </Panel>
  );
}
