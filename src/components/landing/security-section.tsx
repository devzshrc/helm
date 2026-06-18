import Link from "next/link";
import Image from "next/image";
import { KeyRound, Lock, ShieldCheck, UserCheck } from "lucide-react";

const POINTS = [
  {
    icon: KeyRound,
    title: "OAuth, not passwords",
    description:
      "We never see or store your Google password. Access is granted (and revocable) through Google's own OAuth flow.",
  },
  {
    icon: Lock,
    title: "Encrypted in transit and at rest",
    description:
      "All data moves over TLS. OAuth tokens are stored encrypted and never exposed in plaintext.",
  },
  {
    icon: UserCheck,
    title: "Approval-gated by default",
    description:
      "Every send, edit, or delete shows an editable preview and waits for your explicit yes — nothing happens silently.",
  },
  {
    icon: ShieldCheck,
    title: "Your data isn't training data",
    description:
      "We don't sell your data or use it to train AI models without your explicit consent.",
  },
];

export function SecuritySection() {
  return (
    <section className="py-16 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mx-auto mb-10 flex max-w-2xl flex-col items-center text-center">
          <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
            Do we steal your data?
          </h2>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            You must be thinking…
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border shadow-sm">
            <Image
              src="https://i.imgflip.com/4hsmz3.jpg"
              alt="You must be thinking: do they steal my data?"
              width={420}
              height={420}
              unoptimized
              className="block"
            />
          </div>
          <p className="text-muted-foreground mt-6 text-sm md:text-base">
            Nope. Here&apos;s exactly how your data stays yours.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex gap-4 rounded-xl border p-5">
              <div className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
                <Icon className="size-5" strokeWidth={1.75} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground mt-8 text-center text-sm">
          Read the full{" "}
          <Link href="/privacy" className="text-foreground underline">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
