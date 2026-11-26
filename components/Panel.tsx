/** A plain page block. The design is full-bleed, so this is only a wrapper with an entry animation. */
export default function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={`sheet enter ${className ?? ""}`}>{children}</section>;
}
