/**
 * All ten misconceptions as one grid, so a student sees the whole topic at a glance:
 * which ideas showed up, which are uncertain, and which were never a problem.
 */

export type TileState = "found" | "possible" | "clear" | "fixed" | "still";

export type MapTile = { code: string; name: string; state: TileState; label: string };

export type LegendItem = { label: string; colour: string; outline?: boolean };

export default function MisconceptionMap({
  tiles,
  legend,
  label,
  delay = 0.6,
}: {
  tiles: MapTile[];
  legend: LegendItem[];
  label: string;
  delay?: number;
}) {
  return (
    <>
      <ul className="map" aria-label={label}>
        {tiles.map((tile, i) => (
          <li key={tile.code} className="tile" data-state={tile.state} style={{ animationDelay: `${delay + i * 0.05}s` }}>
            <span className="tile-code">{tile.code}</span>
            <span className="tile-name">{tile.name}</span>
            <span className="tile-state">{tile.label}</span>
          </li>
        ))}
      </ul>
      <ul className="legend" aria-hidden="true">
        {legend.map((item) => (
          <li key={item.label}>
            <i style={item.outline ? { border: "1px solid var(--mark)" } : { background: item.colour }} />
            {item.label}
          </li>
        ))}
      </ul>
    </>
  );
}
