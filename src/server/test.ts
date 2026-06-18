import "dotenv/config";
import { withCorsair } from "./corsair";
const main = async () => {
  // const res = await corsair.withTenant("dev").gmail.api.threads.list({});
  // corsair does caching - so we can just do
  // const res = await corsair.withTenant("dev").gmail.db.threads.list();
  // so we wont be rate-limited by google
  const res = await withCorsair((corsair) =>
    corsair.withTenant("dev").googlecalendar.api.events.create({
      event: {
        summary: "Test Event",
        description: "This is a test event",
        start: {
          date: "2026-06-14",
        },
        end: {
          date: "2026-06-14",
        },
        location: "123 Main St, Anytown, USA",
        attendees: [
          {
            email: "test@example.com",
            responseStatus: "accepted",
          },
        ],
      },
    }),
  );

  console.log(res);
};
void main();
