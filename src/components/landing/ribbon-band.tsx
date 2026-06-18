import { InfiniteRibbon } from "~/components/ui/infinite-ribbon";

const PHRASES = [
  "Triage mail",
  "Draft replies before you open them",
  "Find free time",
  "Schedule meetings",
  "Automate your inbox",
  "Helm does the work in it",
];

function Track() {
  return (
    <span className="flex items-center">
      {PHRASES.map((p) => (
        <span key={p} className="flex items-center">
          {p}
          <span aria-hidden className="text-primary-foreground/50 mx-6">
            ◆
          </span>
        </span>
      ))}
    </span>
  );
}

export function RibbonBand() {
  return (
    <section className="my-20 flex flex-col gap-1.5 overflow-hidden">
      <InfiniteRibbon duration={40}>
        <Track />
      </InfiniteRibbon>
      <InfiniteRibbon duration={40} reverse>
        <Track />
      </InfiniteRibbon>
    </section>
  );
}
