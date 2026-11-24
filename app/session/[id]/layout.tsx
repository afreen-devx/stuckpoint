import Stepper from "@/components/Stepper";

/** Every session page shares the stepper and the page shell. */
export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell">
      <Stepper />
      {children}
    </main>
  );
}
