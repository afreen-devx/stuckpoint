import { cookies } from "next/headers";
import TeacherLogin from "@/components/TeacherLogin";
import { allAnswers, allLlmCalls, allMasteryChecks, allSessions, usingTurso } from "@/lib/db";
import { loadPack } from "@/lib/pack";
import { aiStats, groupStats, isTeacher, summarise, TEACHER_COOKIE, teacherPin } from "@/lib/teacher";
import { LANGUAGE_LABEL, type Language } from "@/lib/types";

export const dynamic = "force-dynamic";

const GROUP_LABEL = { stuckpoint: "StuckPoint", control: "ChatGPT Study Mode" } as const;
const n = (v: number | null) => (v === null ? "–" : String(v));

/** Class results for the teacher, behind TEACHER_PIN: group comparison, every session, AI health, exports. */
export default async function TeacherPage() {
  const signedIn = isTeacher((await cookies()).get(TEACHER_COOKIE)?.value);

  if (!signedIn) {
    return (
      <main className="shell">
        <section className="enter">
          <p className="eyebrow">Teacher view</p>
          <h1 className="page-title">
            Class results, <em>behind a PIN.</em>
          </h1>
          <p className="lede">
            {teacherPin()
              ? "Enter the teacher PIN to see every session, the group comparison and the class exports."
              : "Set TEACHER_PIN in the app settings first. Until then the teacher view stays locked."}
          </p>
          {teacherPin() ? <TeacherLogin /> : null}
        </section>
      </main>
    );
  }

  const pack = loadPack();
  const [sessions, answers, checks, calls] = await Promise.all([allSessions(), allAnswers(), allMasteryChecks(), allLlmCalls()]);
  const rows = summarise(pack, sessions, answers, checks);
  const groups = groupStats(rows);
  const ai = aiStats(calls);

  return (
    <main className="shell">
      <section className="enter">
        <p className="eyebrow">
          Teacher view · {sessions.length} {sessions.length === 1 ? "session" : "sessions"} · data in{" "}
          {usingTurso() ? "Turso" : "a local file"}
        </p>
        <h1 className="page-title">
          Did they <em>actually learn?</em>
        </h1>
        <p className="lede">
          Scores out of 10, on fixed answer keys. Averages use finished sessions only (pre-test and post-test both
          complete). Retention is the test taken 3 to 4 days later.
        </p>
      </section>

      {groups.length > 0 ? (
        <div className="t-groups">
          {groups.map((g) => (
            <section key={g.group} className="t-group" data-group={g.group}>
              <p className="dx-flag">
                {GROUP_LABEL[g.group]} · {g.finished} of {g.sessions} finished
              </p>
              <div className="delta">
                <span className="delta-n is-pre">{n(g.meanPre)}</span>
                <span className="delta-arr" aria-hidden="true">
                  →
                </span>
                <span className="delta-n is-post">{n(g.meanPost)}</span>
              </div>
              <dl className="t-stats">
                <div>
                  <dt>Mean gain</dt>
                  <dd>{g.meanGain === null ? "–" : `${g.meanGain > 0 ? "+" : ""}${g.meanGain}`}</dd>
                </div>
                <div>
                  <dt>Retention</dt>
                  <dd>{g.retentionTaken ? `${n(g.meanRetention)} (${g.retentionTaken})` : "–"}</dd>
                </div>
                <div>
                  <dt>Misconceptions fixed</dt>
                  <dd>
                    {g.fixed} of {g.showingBefore}
                  </dd>
                </div>
              </dl>
            </section>
          ))}
        </div>
      ) : (
        <p className="lede">No sessions yet.</p>
      )}

      <div className="page-foot">
        <div className="stack">
          <p className="hint">
            AI health: {ai.calls} calls, {ai.failed} failed ({ai.timeouts} too slow, {ai.rateLimited} over the free
            limit), typical reply {ai.medianMs === null ? "–" : `${(ai.medianMs / 1000).toFixed(1)} s`}.
          </p>
          <p className="hint">Small groups vary a lot. Report the numbers with the group sizes, as early evidence.</p>
        </div>
        <div className="form-actions">
          <a className="btn-primary" href="/api/teacher/export?kind=sessions">
            Download sessions (CSV)
          </a>
          <a className="btn-quiet" href="/api/teacher/export?kind=answers">
            All answers (CSV)
          </a>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="rows result-table-wrap">
          <table className="result-table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Group</th>
                <th scope="col">Step</th>
                <th scope="col">Pre</th>
                <th scope="col">Post</th>
                <th scope="col">Retention</th>
                <th scope="col">Misconceptions before → after</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <a className="code" href={`/api/export?id=${r.id}`} title="Download this session's log">
                      {r.studentId}
                    </a>
                    <span className="flag-q">
                      {r.classCode ? `${r.classCode} · ` : ""}
                      {LANGUAGE_LABEL[r.language as Language] ?? r.language}
                    </span>
                  </td>
                  <td>{GROUP_LABEL[r.group]}</td>
                  <td className="mono">{r.phase}</td>
                  <td className="mono">{n(r.pre)}</td>
                  <td className="mono">{n(r.post)}</td>
                  <td className="mono">{n(r.retention)}</td>
                  <td className="mono">
                    {r.showingPre.join(" ") || "none"} → {r.post === null ? "…" : r.showingPost.join(" ") || "none"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
