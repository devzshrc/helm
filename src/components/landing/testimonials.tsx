"use client";

import { useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { NewTwitterIcon } from "@hugeicons/core-free-icons";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

type Testimonial = {
  image: string;
  name: string;
  username: string;
  text: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    image:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop",
    name: "Rohit Mehra",
    username: "@rohitships",
    text: "Inbox itna khaali ho gaya ki ab procrastinate karne ke liye kuch bacha hi nahi. Productivity ruined my hobbies. 10/10.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop",
    name: "Sneha Kapoor",
    username: "@snehapm",
    text: "Bola 'invite bhej Thursday 9 baje' — agent ne bhej bhi diya. Ab mujhe sach me meeting attend karni padegi. Bekaar feature. ⭐⭐⭐⭐⭐",
  },
  {
    image:
      "https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=200&auto=format&fit=crop",
    name: "Arjun Nair",
    username: "@arjuncodes",
    text: "Pehle 200 unread the, ab Focus view me sirf 3. Mera weekend ka excuse chala gaya. Thanks Helm, ab kaam karna padega.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
    name: "Priya Sharma",
    username: "@priyabuilds",
    text: "Workflow banaya: newsletter aaya → label → archive. Mummy ke forwards bhi auto-archive ho rahe. Privacy from family, finally.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop",
    name: "Karan Singh",
    username: "@karanhustles",
    text: "Approval cards dekh ke laga AI trust kar raha hai mujhe. Plot twist: main hi galat 'Approve' dabata hoon. Skill issue, not Helm issue.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
    name: "Neha Verma",
    username: "@nehaships",
    text: "Semantic search ne 'spring wala contract' nikaal diya bina exact words ke. Mera memory ab officially redundant hai.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
    name: "Vikram Reddy",
    username: "@vikramwrites",
    text: "Keyboard shortcuts itne fast hai ki mouse ne resignation de diya. j, k, e — bas yahi meri personality ban gayi.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop",
    name: "Ananya Iyer",
    username: "@ananyapm",
    text: "Realtime itna fast hai ki email aane se pehle hi Helm bata deta hai. Thoda dramatic hai par main impressed hoon.",
  },
];

const maxDisplayed = 6;

export function Testimonials({ className }: { className?: string }) {
  const [showAll, setShowAll] = useState(false);

  return (
    <section className={cn("py-24 md:py-32", className)}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-foreground text-3xl font-light tracking-tight md:text-4xl">
            Loved by people who hate email
          </h2>
          <p className="text-muted-foreground mt-3">
            Definitely real users. Definitely not written at 2am.
          </p>
        </div>

        <div className="relative">
          <div
            className={cn(
              "flex flex-wrap items-start justify-center gap-5",
              !showAll &&
                TESTIMONIALS.length > maxDisplayed &&
                "max-h-[640px] overflow-hidden",
            )}
          >
            {TESTIMONIALS.slice(0, showAll ? undefined : maxDisplayed).map(
              (t, i) => (
                <Card key={i} className="relative h-auto w-80 p-5">
                  <div className="flex items-center">
                    <Image
                      src={t.image}
                      alt={t.name}
                      width={48}
                      height={48}
                      className="size-12 rounded-full object-cover"
                    />
                    <div className="flex flex-col pl-4">
                      <span className="text-base font-semibold">{t.name}</span>
                      <span className="text-muted-foreground text-sm">
                        {t.username}
                      </span>
                    </div>
                    <HugeiconsIcon
                      icon={NewTwitterIcon}
                      strokeWidth={2}
                      className="text-muted-foreground absolute top-4 right-4 size-4"
                    />
                  </div>
                  <p className="text-foreground mt-5">{t.text}</p>
                </Card>
              ),
            )}
          </div>

          {TESTIMONIALS.length > maxDisplayed && !showAll && (
            <>
              <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t to-transparent" />
              <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
                <Button variant="secondary" onClick={() => setShowAll(true)}>
                  Load more
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
