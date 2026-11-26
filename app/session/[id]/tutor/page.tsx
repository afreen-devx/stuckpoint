import { notFound, redirect } from "next/navigation";
import FoundationsRunner from "@/components/FoundationsRunner";
import Panel from "@/components/Panel";
import PhaseButton from "@/components/PhaseButton";
import TutorRunner from "@/components/TutorRunner";
import { getSession } from "@/lib/db";
import { llmConfigured } from "@/lib/llm";
import { loadPack } from "@/lib/pack";
import { phaseHref } from "@/lib/session";
import { conversation, evidenceFor, FOUNDATIONS, readReady, tutorPlan } from "@/lib/tutor";
import { LANGUAGE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Captions for the motion lab beside ideas that a falling ball can teach. Never used on test pages. */
const LAB_CAPTION: Record<string, string> = {
  M1: "At t = 0 the speed is zero, yet the speed line is already climbing. Zero speed does not mean zero acceleration.",
  M3: "Gravity pulls down the whole time, so the speed grows by 10 m/s every second.",
  M8: "Mass appears nowhere here. Any ball dropped from 20 m takes the same 2.0 s, if there is no air resistance.",
  M9: "This is only the downward part of the motion. A ball fired sideways from 20 m also takes 2.0 s to land.",
  M10: "At the start the ball is at rest for an instant, but the speed line climbs straight away.",
};

export default async function TutorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  if (session.phase !== "tutor") redirect(phaseHref(session.id, session.phase));

  const pack = loadPack();
  const { items, current } = await tutorPlan(session, pack);
  const position = current ? items.findIndex((i) => i.code === current.code) + 1 : items.length;

  if (!current) {
    const mastered = items.filter((i) => i.mastered).length;
    return (
      <Panel>
        <p className="eyebrow">Step 03 · Tutoring · done</p>
        <h1 className="page-title">
          Tutoring done. Now prove it on <em>ten new questions.</em>
        </h1>
        <p className="lede">
          {items.length === 0
            ? "There was nothing to tutor this time."
            : `You worked through ${items.length} ${items.length === 1 ? "idea" : "ideas"}${mastered > 0 ? ` and passed the check on ${mastered}` : ""}.`}{" "}
          The post-test uses different questions on the same ideas, scored against fixed answers.
        </p>
        <div className="page-foot">
          <PhaseButton sessionId={session.id} to="posttest">
            Start the post-test
          </PhaseButton>
        </div>
      </Panel>
    );
  }

  const header = {
    eyebrow: `Step 03 · Tutoring · idea ${position} of ${items.length} · ${LANGUAGE_LABEL[session.language]}`,
    items,
  };

  if (current.code === FOUNDATIONS && pack.foundations) {
    return <FoundationsRunner key={current.code} sessionId={session.id} header={header} foundations={pack.foundations} />;
  }

  const m = pack.misconceptions[current.code];
  const turns = (await conversation(session.id, current.code)).map((t) => {
    if (t.role === "student") return { ...t, ready: false };
    const r = readReady(t.text);
    return { role: t.role, text: r.text, ready: r.ready };
  });

  const evidence = (await evidenceFor(session, pack, current.code)).map((e) => ({ label: e.label, chose: e.chose, reason: e.reason }));

  return (
    <TutorRunner
      key={current.code}
      sessionId={session.id}
      header={header}
      code={current.code}
      name={m.name}
      belief={m.belief}
      evidence={evidence}
      initialTurns={turns}
      aiReady={llmConfigured()}
      lab={LAB_CAPTION[current.code] ?? null}
    />
  );
}
