import "server-only";

import {
  sendEmail,
  archiveThread,
  markThreadRead,
  starThread,
  applyLabel,
} from "~/server/gmail";
import { createEvent, updateEvent, deleteEvent } from "~/server/calendar";
import {
  WRITE_TOOLS,
  type WriteTool,
  writeSchemas,
  describeAction,
  clean,
} from "~/lib/ai/write-actions";

export { WRITE_TOOLS, writeSchemas, describeAction };
export type { WriteTool };

/** Executes an approved write action against Corsair / Gmail / Calendar. */
export async function executeWriteAction(
  tenantId: string,
  toolName: WriteTool,
  rawInput: unknown,
): Promise<string> {
  switch (toolName) {
    case "send_email": {
      const i = writeSchemas.send_email.parse(rawInput);
      if (!i.to.trim() || !i.subject.trim() || !i.body.trim()) {
        throw new Error("Email recipient, subject, and body are required.");
      }
      const res = await sendEmail(tenantId, {
        to: i.to,
        subject: i.subject,
        text: i.body,
      });
      return `Email sent to ${i.to} (id ${res.id ?? "?"})`;
    }
    case "create_event": {
      const i = clean(writeSchemas.create_event.parse(rawInput));
      if (!i.summary.trim() || !i.start.trim() || !i.end.trim()) {
        throw new Error("Event title, start, and end are required.");
      }
      const ev = await createEvent(tenantId, i);
      return `Event "${ev.summary}" created${ev.attendees.length ? `, invited ${ev.attendees.length}` : ""}`;
    }
    case "update_event": {
      const { id, ...rest } = writeSchemas.update_event.parse(rawInput);
      if (!rest.summary.trim() || !rest.start.trim() || !rest.end.trim()) {
        throw new Error("Event title, start, and end are required.");
      }
      const ev = await updateEvent(tenantId, id, clean(rest));
      return `Event "${ev.summary}" updated`;
    }
    case "delete_event": {
      const i = writeSchemas.delete_event.parse(rawInput);
      await deleteEvent(tenantId, i.id);
      return `Event ${i.id} cancelled`;
    }
    case "archive_thread": {
      const i = writeSchemas.archive_thread.parse(rawInput);
      await archiveThread(tenantId, i.threadId);
      return `Archived "${i.subject}"`;
    }
    case "mark_thread_read": {
      const i = writeSchemas.mark_thread_read.parse(rawInput);
      await markThreadRead(tenantId, i.threadId, true);
      return `Marked as read: "${i.subject}"`;
    }
    case "star_thread": {
      const i = writeSchemas.star_thread.parse(rawInput);
      await starThread(tenantId, i.threadId, true);
      return `Starred "${i.subject}"`;
    }
    case "label_thread": {
      const i = writeSchemas.label_thread.parse(rawInput);
      await applyLabel(tenantId, i.threadId, i.labelName);
      return `Labelled "${i.subject}" → ${i.labelName}`;
    }
  }
}
