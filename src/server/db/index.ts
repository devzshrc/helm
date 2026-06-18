import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "~/env";
import * as schema from "./schema";

export const conn = neon(
  env.DATABASE_URL ?? "postgresql://user:password@localhost/placeholder",
);

export const db = drizzle(conn, { schema });
