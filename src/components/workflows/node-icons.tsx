import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon,
  Clock01Icon,
  Calendar03Icon,
  FilterIcon,
  AiMagicIcon,
  Tag01Icon,
  Archive02Icon,
  MailOpen01Icon,
  StarIcon,
  ArrowTurnBackwardIcon,
  ArrowTurnForwardIcon,
  SentIcon,
} from "@hugeicons/core-free-icons";

import type { NodeType, TriggerType } from "~/lib/workflows/types";

const NODE_ICON: Record<NodeType, typeof Mail01Icon> = {
  filter: FilterIcon,
  ai_summarize: AiMagicIcon,
  ai_draft: AiMagicIcon,
  ai_classify: AiMagicIcon,
  ai_digest: AiMagicIcon,
  label: Tag01Icon,
  move_to_label: Tag01Icon,
  add_note: Mail01Icon,
  archive: Archive02Icon,
  mark_read: MailOpen01Icon,
  star: StarIcon,
  reply: ArrowTurnBackwardIcon,
  forward: ArrowTurnForwardIcon,
  send_email: SentIcon,
  create_event: Calendar03Icon,
};

const TRIGGER_ICON: Record<TriggerType, typeof Mail01Icon> = {
  email: Mail01Icon,
  schedule: Clock01Icon,
  calendar: Calendar03Icon,
};

export function NodeIcon({
  type,
  className,
}: {
  type: NodeType;
  className?: string;
}) {
  return (
    <HugeiconsIcon
      icon={NODE_ICON[type]}
      strokeWidth={2}
      className={className}
    />
  );
}

export function TriggerIcon({
  type,
  className,
}: {
  type: TriggerType;
  className?: string;
}) {
  return (
    <HugeiconsIcon
      icon={TRIGGER_ICON[type]}
      strokeWidth={2}
      className={className}
    />
  );
}
