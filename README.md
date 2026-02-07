# a quiet ritual

Minimal, private journaling ritual built with Next.js App Router, TypeScript, Tailwind, Postgres, Prisma, and email magic-link auth.

## Core stack

- Next.js (App Router)
- Prisma + PostgreSQL
- NextAuth (email magic link, no passwords)
- Zod for request validation

## Local development

1. Install dependencies:

```bash
npm install
```

2. Copy env template and fill values:

```bash
cp .env.example .env
```

### Database env setup

Create `.env.local` for Next.js runtime values and create `.env` for Prisma CLI.
Set `DATABASE_URL` in `.env` (and keep `.env.local` in sync if you also use it there).

Example:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
```

3. Run migrations and seed prompts:

```bash
npm run prisma:migrate:dev
npm run prisma:seed
```

4. Start dev server:

```bash
npm run dev
```

## API routes

- `GET /api/prompt/today` public daily prompt
- `GET /api/entries` authenticated user entries
- `POST /api/entries` authenticated create entry
- `DELETE /api/account` authenticated account + data deletion

## Privacy and security notes

- No passwords, only email magic link sign-in.
- No public profiles, usernames, or follower mechanics.
- Journal reads/writes are authenticated and scoped to session user ID.
- Input validation on write/delete endpoints with Zod.
- Same-origin check for mutating endpoints (`POST`/`DELETE`) to reduce CSRF risk.
- Rate limiting on auth and write endpoints.
- No server logging of journal content.
- Secrets are environment variables only.

## Deployment checklist (Vercel + managed Postgres)

1. Provision managed Postgres and set `DATABASE_URL`.
2. Set auth/email env vars in Vercel:
   - `AUTH_SECRET`
   - `EMAIL_FROM`
   - `EMAIL_SERVER_HOST`
   - `EMAIL_SERVER_PORT`
   - `EMAIL_SERVER_USER`
   - `EMAIL_SERVER_PASSWORD`
3. Run migrations in deploy pipeline:
   - `npm run prisma:migrate:deploy`
4. Seed prompts once:
   - `npm run prisma:seed`
5. Confirm email deliverability (SPF/DKIM/DMARC) for your sender domain.
