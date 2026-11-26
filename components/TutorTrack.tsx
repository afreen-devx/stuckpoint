/** The ideas being tutored this session, with where the student is. */

export type TrackHeader = {
  eyebrow: string;
  items: { code: string; name: string; state: "done" | "skipped" | "current" | "todo"; mastered: boolean | null }[];
};

const STATE_LABEL = { done: "Done", skipped: "Skipped", current: "Now", todo: "Next" } as const;

export default function TutorTrack({ header }: { header: TrackHeader }) {
  return (
    <>
      <p className="eyebrow">{header.eyebrow}</p>
      <ol className="track" aria-label="Ideas this session">
        {header.items.map((item) => (
          <li key={item.code} className="track-item" data-state={item.state}>
            <span className="track-code">{item.code === "F" ? "Basics" : item.code}</span>
            <span className="track-state">
              {item.state === "done" && item.mastered ? "Mastered" : STATE_LABEL[item.state]}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
