# a quiet ritual

Minimal, private journaling ritual built with Next.js App Router, TypeScript, Tailwind, Postgres, Prisma, and NextAuth credentials auth.

## Core stack

- Next.js (App Router)
- Prisma + PostgreSQL
- NextAuth (email + password)
- Resend HTTP API (verification + password reset emails)
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
- `POST /api/auth/signup` create account + send verification email
- `POST /api/auth/verify-email` verify one-time email token
- `POST /api/auth/forgot-password` request reset email
- `POST /api/auth/reset-password` reset password with one-time token

## Privacy and security notes

- Passwords are hashed with bcrypt before storage.
- No public profiles, usernames, or follower mechanics.
- Journal reads/writes are authenticated and scoped to session user ID.
- Input validation on write/delete endpoints with Zod.
- Same-origin check for mutating endpoints (`POST`/`DELETE`) to reduce CSRF risk.
- Rate limiting on auth and write endpoints.
- Verification/reset tokens are one-time, hashed in DB, and expire in 1 hour.
- No server logging of journal content.
- Secrets are environment variables only.

## Troubleshooting

- `HTTP 431 Request Header Fields Too Large` after avatar/profile updates:
  - cause: old oversized auth cookies from previously storing large session payloads.
  - fix: clear site cookies for this app domain, then sign in again.
  - prevention: session cookies now only store minimal fields (`id`, `email`, `role`, `username`) and never avatar data.

## Deployment checklist (Vercel + managed Postgres)

1. Provision managed Postgres and set `DATABASE_URL`.
2. Set auth/email env vars in Vercel:
   - `AUTH_SECRET`
   - `AUTH_URL` (or `NEXTAUTH_URL`)
   - `EMAIL_FROM`
   - `RESEND_API_KEY`
3. Run migrations in deploy pipeline:
   - `npm run prisma:migrate:deploy`
4. Seed prompts once:
   - `npm run prisma:seed`
5. Confirm email deliverability (SPF/DKIM/DMARC) for your sender domain in Resend.
