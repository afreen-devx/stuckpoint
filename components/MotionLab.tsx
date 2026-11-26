"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Motion lab: a ball dropped from rest, drawn in sync with its height-time and speed-time graphs.
 * Outlined circles mark where the ball was every 0.2 s, so equal time steps show growing gaps.
 *
 * It shows speed, not signed velocity, so it never teaches a sign convention by accident.
 * Keep it off the test pages: a moving graph there could give answers away.
 */

const G = 10; // m/s², the pack's convention
const STROBE = 0.2; // seconds between ghost circles
const HOLD = 1.6; // seconds to pause at the end before looping
const W = 560;
const H = 330;
const SHAFT_X = 92;
const GX = 150;
const GW = 390;
const G1 = { top: 24, h: 120 };
const G2 = { top: 186, h: 120 };
const NS = "http://www.w3.org/2000/svg";

type Props = { h0: number; title: string; caption: string };

export default function MotionLab({ h0, title, caption }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);
  const [readout, setReadout] = useState({ t: 0, h: h0, v: 0 });
  const control = useRef({ playing: true, speed: 1 });

  useEffect(() => {
    control.current.playing = playing;
  }, [playing]);

  useEffect(() => {
    control.current.speed = slow ? 0.5 : 1;
  }, [slow]);

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const T = Math.sqrt((2 * h0) / G);
    const vmax = G * T;
    const yOf = (h: number) => G1.top + (1 - h / h0) * (G2.top + G2.h - G1.top);
    const gx = (t: number) => GX + (t / T) * GW;
    const gh = (h: number) => G1.top + G1.h - (h / h0) * G1.h;
    const gs = (s: number) => G2.top + G2.h - (s / vmax) * G2.h;

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `A ball dropped from ${h0} m, with its height-time and speed-time graphs drawn as it falls.`);
    root.replaceChildren(svg);

    const el = (tag: string, attrs: Record<string, string | number>, parent: Element = svg) => {
      const node = document.createElementNS(NS, tag);
      for (const key in attrs) node.setAttribute(key, String(attrs[key]));
      parent.appendChild(node);
      return node;
    };
    const label = (x: number, y: number, text: string, anchor = "end", size = 9) => {
      const node = el("text", { x, y, "text-anchor": anchor, "font-size": size });
      node.textContent = text;
    };
    const axis = { stroke: "var(--ink-2)", "stroke-width": 1 };

    // Drop shaft with a height ruler.
    el("line", { ...axis, x1: SHAFT_X, y1: yOf(h0) - 6, x2: SHAFT_X, y2: yOf(0) });
    const step = h0 > 30 ? 10 : 5;
    for (let h = step; h <= h0; h += step) {
      el("line", { stroke: "var(--mark)", x1: SHAFT_X - 6, x2: SHAFT_X, y1: yOf(h), y2: yOf(h) });
      label(SHAFT_X - 10, yOf(h) + 3, `${h} m`);
    }
    el("line", { ...axis, x1: SHAFT_X - 24, x2: SHAFT_X + 24, y1: yOf(0), y2: yOf(0) });

    // Two stacked graphs sharing one time axis.
    const graph = (g: { top: number; h: number }, name: string, ticks: [string, number][]) => {
      for (const [text, y] of ticks) {
        el("line", { stroke: "var(--line-soft)", x1: GX, x2: GX + GW, y1: y, y2: y });
        label(GX - 6, y + 3, text);
      }
      el("line", { ...axis, x1: GX, y1: g.top, x2: GX, y2: g.top + g.h });
      el("line", { ...axis, x1: GX, y1: g.top + g.h, x2: GX + GW, y2: g.top + g.h });
      label(GX + 6, g.top + 10, name, "start", 10);
    };
    const round = (n: number) => String(Math.round(n * 10) / 10);
    graph(G1, "height (m)", [[round(h0), gh(h0)], [round(h0 / 2), gh(h0 / 2)], ["0", gh(0)]]);
    graph(G2, "speed (m/s)", [[round(vmax), gs(vmax)], [round(vmax / 2), gs(vmax / 2)], ["0", gs(0)]]);
    for (let s = 0; s <= T + 1e-9; s += 0.5) label(gx(s), G2.top + G2.h + 14, s.toFixed(1), "middle");
    label(GX + GW, G2.top + G2.h - 6, "t (s)", "end", 10);

    const curveH = el("path", { fill: "none", stroke: "var(--accent)", "stroke-width": 2.5, "stroke-linecap": "round" });
    const curveV = el("path", { fill: "none", stroke: "var(--data)", "stroke-width": 2.5, "stroke-linecap": "round" });
    const head = el("line", { stroke: "var(--faint)", "stroke-dasharray": "2 3", y1: G1.top, y2: G2.top + G2.h });
    const dotH = el("circle", { r: 4, fill: "var(--accent)" });
    const dotV = el("circle", { r: 4, fill: "var(--data)" });
    const ghosts = el("g", {});
    const link = el("line", { stroke: "var(--accent)", "stroke-opacity": 0.35, "stroke-dasharray": "2 3", x1: SHAFT_X });
    const ball = el("circle", { r: 9, fill: "var(--accent)", cx: SHAFT_X, cy: yOf(h0) });

    let lastGhost = -1;
    let lastReadout = 0;
    const draw = (time: number) => {
      const t = Math.min(time, T);
      const h = h0 - 0.5 * G * t * t;
      const v = G * t;
      const y = yOf(h);
      ball.setAttribute("cy", String(y));

      const k = Math.floor(t / STROBE + 1e-9);
      for (let i = lastGhost + 1; i <= k; i++) {
        const ti = i * STROBE;
        if (ti > T) break;
        el("circle", { r: 9, fill: "none", stroke: "var(--data)", "stroke-opacity": 0.55, cx: SHAFT_X, cy: yOf(h0 - 0.5 * G * ti * ti) }, ghosts);
      }
      lastGhost = Math.max(lastGhost, k);

      let pH = "";
      let pV = "";
      for (let i = 0; i <= 48; i++) {
        const ti = (t * i) / 48;
        pH += `${i ? "L" : "M"}${gx(ti).toFixed(1)} ${gh(h0 - 0.5 * G * ti * ti).toFixed(1)}`;
        pV += `${i ? "L" : "M"}${gx(ti).toFixed(1)} ${gs(G * ti).toFixed(1)}`;
      }
      curveH.setAttribute("d", pH);
      curveV.setAttribute("d", pV);
      const x = gx(t);
      for (const [node, attrs] of [
        [head, { x1: x, x2: x }],
        [dotH, { cx: x, cy: gh(h) }],
        [dotV, { cx: x, cy: gs(v) }],
        [link, { y1: y, y2: gh(h), x2: x }],
      ] as [Element, Record<string, number>][]) {
        for (const key in attrs) node.setAttribute(key, String(attrs[key]));
      }

      // Readouts update a few times a second, which is plenty to read and cheap for React.
      const now = performance.now();
      if (now - lastReadout > 60 || t === T || t === 0) {
        lastReadout = now;
        setReadout({ t, h: Math.max(0, h), v });
      }
    };
    const reset = () => {
      ghosts.replaceChildren();
      lastGhost = -1;
      draw(0);
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      reset();
      draw(T);
      setPlaying(false);
      return;
    }

    let frame = 0;
    let prev: number | null = null;
    let t = 0;
    let hold = 0;
    reset();
    const loop = (now: number) => {
      const dt = prev === null ? 0 : Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (control.current.playing) {
        if (t < T) {
          t = Math.min(T, t + dt * control.current.speed);
          draw(t);
        } else {
          hold += dt;
          if (hold > HOLD) {
            hold = 0;
            t = 0;
            reset();
          }
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [h0]);

  return (
    <div className="lab">
      <div className="lab-head">
        <span className={`lab-live ${playing ? "" : "is-off"}`} aria-hidden="true" />
        <span className="lab-title">Motion lab</span>
        <span>{title}</span>
        <div className="lab-ctrl">
          <button type="button" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" aria-pressed={slow} onClick={() => setSlow((s) => !s)}>
            0.5x
          </button>
        </div>
      </div>
      <div ref={host} />
      <dl className="lab-readout" aria-live="off">
        <div>
          <dt>Time</dt>
          <dd>
            {readout.t.toFixed(2)}
            <small>s</small>
          </dd>
        </div>
        <div>
          <dt>Height</dt>
          <dd>
            {readout.h.toFixed(1)}
            <small>m</small>
          </dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>
            {readout.v.toFixed(1)}
            <small>m/s</small>
          </dd>
        </div>
      </dl>
      <p className="lab-caption">{caption}</p>
    </div>
  );
}
