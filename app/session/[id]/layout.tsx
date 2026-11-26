/** Every session page shares the page shell. The step track lives in the top bar. */
export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return <main className="shell">{children}</main>;
}
