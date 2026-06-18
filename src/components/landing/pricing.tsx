import Image from "next/image";

export function Pricing() {
  return (
    <section id="pricing" className="bg-muted/40 py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-foreground text-3xl font-light tracking-tight md:text-4xl">
          Simple pricing
        </h2>
        <p className="text-muted-foreground mt-3">
          Start free. Upgrade when Helm becomes your whole workflow.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="overflow-hidden rounded-2xl border shadow-sm">
            <Image
              src="https://media.tenor.com/ZsPg_PC9eTgAAAAd/imran-hashmi-jannat.gif"
              alt="Currently everything is free. For how long? Nobody knows."
              width={480}
              height={480}
              unoptimized
              className="block"
            />
          </div>
          <p className="text-muted-foreground text-base">
            CHALU HAI MATLAB CHAL RAHA HAI, KABTAK CHALEGA 🤷
          </p>
        </div>
      </div>
    </section>
  );
}
