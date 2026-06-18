# Deploying Helm (Vercel)

The app deploys to Vercel (Next.js App Router, Node runtime). `src/env.js`
validates required vars at module load, so an incomplete env makes every DB/auth
route 500 while static pages still render — `GET /api/health` reports this as
`{"reason":"runtime_env_invalid"}`. Set every required var in the Vercel project
**before** the first production deploy.

## 1. Environment variables (Vercel → Project → Settings → Environment Variables)

Add for the **Production** (and Preview) environment. Paste values from `.env`.

Required (env validation fails without these):

```
BETTER_AUTH_SECRET
BETTER_AUTH_GOOGLE_CLIENT_ID
BETTER_AUTH_GOOGLE_CLIENT_SECRET
CORSAIR_KEK
CORSAIR_WEBHOOK_TOKEN
CRON_SECRET
DATABASE_URL
BETTER_AUTH_URL          = https://helm.devzshrc.in   (your production URL)
```

Recommended (features degrade silently without them):

```
GROQ_API_KEY             # agent / AI — required for the assistant
GEMINI_API_KEY           # embeddings / semantic search
GOOGLE_PUBSUB_SA_EMAIL   # webhook OIDC verification
UPSTASH_REDIS_REST_URL   # durable rate limiting (pair)
UPSTASH_REDIS_REST_TOKEN
BETTER_AUTH_TRUSTED_ORIGINS   # only if serving extra domains
```

`NODE_ENV` is set to `production` by Vercel automatically — do not add it.

Or set them from the CLI:

```sh
vercel link            # once, to associate the repo with the project
vercel env add BETTER_AUTH_SECRET production
# …repeat per var, or `vercel env pull` to sync down
```

## 2. Google OAuth console

In Google Cloud Console → Credentials → the OAuth Web client, add:

- Authorized redirect URI: `https://helm.devzshrc.in/api/auth/callback/google`
- Authorized JavaScript origin: `https://helm.devzshrc.in`

(Keep the localhost entries for local dev.)

## 2.1 Corsair Gmail + Calendar setup

Corsair credentials must live in env/Corsair secure config, never in source.
Verify plugin operations before deploy:

```sh
bunx corsair list -p gmail
bunx corsair list -p googlecalendar
```

Configure the Google OAuth app credentials for each plugin with secret values
from the deployment environment:

```sh
bunx corsair setup -p gmail clientId="<google-client-id>" clientSecret="<google-client-secret>"
bunx corsair setup -p googlecalendar clientId="<google-client-id>" clientSecret="<google-client-secret>"
```

Users should connect through Helm's OAuth routes:

```text
/api/corsair/connect?plugin=gmail
/api/corsair/connect?plugin=googlecalendar
```

For diagnostics only, inspect a tenant/plugin with:

```sh
bunx corsair auth -p gmail -t "<tenant-id>" -C
bunx corsair auth -p googlecalendar -t "<tenant-id>" -C
```

## 3. Domain + DNS

Add `helm.devzshrc.in` under Vercel → Project → Settings → Domains, then point
DNS at Vercel (CNAME `cname.vercel-dns.com`, or the A record Vercel shows). The
domain currently resolves to Cloudflare — repoint it.

## 4. Database migrations

Schema is kept current with `drizzle-kit push`. Apply pending changes to the
production Neon DB before deploy:

```sh
DATABASE_URL="<prod-neon-url>" bun run db:push   # or db:migrate
```

## 5. Deploy

Either connect the GitHub repo in the Vercel dashboard (auto-deploys on push to
`main`), or from the CLI:

```sh
vercel --prod
```

## 6. Verify

```sh
curl -s https://helm.devzshrc.in/api/health        # expect 200 {"db":"up"}
curl -sI -X POST https://helm.devzshrc.in/api/auth/sign-in/social \
  -H 'content-type: application/json' -d '{"provider":"google","callbackURL":"/"}'
# expect 200 with a Google redirect URL in the body, not 500
```

## Cron

Vercel Hobby caps crons at once/day, so the 15-min drain runs from **GitHub
Actions** instead (`.github/workflows/cron-tick.yml`), which GETs
`/api/cron/tick` with `Authorization: Bearer <CRON_SECRET>` — the same header the
route requires.

Set it up:

- Add repo secret `CRON_SECRET` (Settings → Secrets and variables → Actions),
  matching the Vercel env var.
- Optional: repo variable `CRON_TARGET_URL` if the domain differs from
  `https://helm.devzshrc.in/api/cron/tick`.

View runs under GitHub → Actions → "Cron tick" (or trigger manually with
`workflow_dispatch`). On Vercel Pro you can instead add a `vercel.json` `crons`
entry with `*/15 * * * *` and drop this workflow.
