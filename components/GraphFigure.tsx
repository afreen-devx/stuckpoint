import type { GraphSpec } from "@/lib/pack";

/**
 * Draws a graph from the pack spec as plain SVG.
 * No crosshair or value readout on test questions: reading values is a skill being tested.
 * Lines draw themselves in once and then stay still, so the animation never hints at an answer.
 */
export default function GraphFigure({
  spec,
  figureNumber,
}: {
  spec: GraphSpec;
  figureNumber: string;
}) {
  const width = 520;
  const height = 248;
  const padLeft = 54;
  const padRight = 22;
  const padTop = 16;
  const padBottom = 36;

  const px = (value: number) => padLeft + (value / spec.xMax) * (width - padLeft - padRight);
  const py = (value: number) => padTop + (1 - value / spec.yMax) * (height - padTop - padBottom);

  const xTicks = [0, 1, 2, 3, 4].map((i) => (spec.xMax / 4) * i);
  const yTicks = [0, 1, 2, 3, 4].map((i) => (spec.yMax / 4) * i);
  const tickText = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

  const caption = spec.yLabel.trim().toLowerCase().startsWith("x") ? "Position-time" : "Velocity-time";
  const colours = ["var(--accent)", "var(--data)"];

  return (
    <figure className="figure">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${caption} graph. ${spec.yLabel} against ${spec.xLabel}.`}
      >
        {/* grid */}
        {xTicks.map((tick) => (
          <line
            key={`gx-${tick}`}
            x1={px(tick)}
            x2={px(tick)}
            y1={py(0)}
            y2={py(spec.yMax)}
            stroke="var(--line-soft)"
            strokeWidth="1"
          />
        ))}
        {yTicks.map((tick) => (
          <line
            key={`gy-${tick}`}
            x1={px(0)}
            x2={px(spec.xMax)}
            y1={py(tick)}
            y2={py(tick)}
            stroke="var(--line-soft)"
            strokeWidth="1"
          />
        ))}

        {/* axes */}
        <line x1={px(0)} x2={px(0)} y1={py(0)} y2={py(spec.yMax)} stroke="var(--mark)" strokeWidth="1.5" />
        <line x1={px(0)} x2={px(spec.xMax)} y1={py(0)} y2={py(0)} stroke="var(--mark)" strokeWidth="1.5" />

        {/* tick labels */}
        {xTicks.map((tick) => (
          <text
            key={`tx-${tick}`}
            x={px(tick)}
            y={py(0) + 16}
            textAnchor="middle"
            fill="var(--faint)"
            fontSize="10"
            fontFamily="var(--mono)"
          >
            {tickText(tick)}
          </text>
        ))}
        {yTicks.map((tick) => (
          <text
            key={`ty-${tick}`}
            x={px(0) - 8}
            y={py(tick) + 3}
            textAnchor="end"
            fill="var(--faint)"
            fontSize="10"
            fontFamily="var(--mono)"
          >
            {tickText(tick)}
          </text>
        ))}

        {/* axis titles */}
        <text x={px(spec.xMax)} y={height - 6} textAnchor="end" fill="var(--muted)" fontSize="11" fontFamily="var(--mono)">
          {spec.xLabel}
        </text>
        <text x={px(0) + 8} y={py(spec.yMax) + 14} fill="var(--muted)" fontSize="11" fontFamily="var(--mono)">
          {spec.yLabel}
        </text>

        {/* marker */}
        {spec.marker ? (
          <g>
            <line
              x1={px(spec.marker.x)}
              x2={px(spec.marker.x)}
              y1={py(0)}
              y2={py(spec.yMax)}
              stroke="var(--mark)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <text
              x={px(spec.marker.x) + 5}
              y={padTop + 10}
              fill="var(--muted)"
              fontSize="10"
              fontFamily="var(--mono)"
            >
              {spec.marker.label}
            </text>
          </g>
        ) : null}

        {/* data lines */}
        {spec.lines.map((line, lineIndex) => {
          const path = line.points
            .map(([x, y], i) => `${i === 0 ? "M" : "L"}${px(x)} ${py(y)}`)
            .join(" ");
          const last = line.points[line.points.length - 1];
          return (
            <g key={lineIndex}>
              <path
                className={`trace trace-${lineIndex + 1}`}
                d={path}
                pathLength={1}
                fill="none"
                stroke={colours[lineIndex % colours.length]}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {line.label ? (
                <text
                  x={px(last[0]) - 6}
                  y={py(last[1]) - 8}
                  textAnchor="end"
                  fill={colours[lineIndex % colours.length]}
                  fontSize="12"
                  fontFamily="var(--mono)"
                >
                  {line.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="figure-cap">
        <span className="fig-no">FIG. {figureNumber}</span>
        {caption}
      </figcaption>
    </figure>
  );
}
