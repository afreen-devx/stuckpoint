import CornerMarks from "./CornerMarks";

/** A bordered panel with corner marks. Used for every plain page block. */
export default function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel-wrap ${className ?? ""}`}>
      <CornerMarks />
      <section className="panel">{children}</section>
    </div>
  );
}
