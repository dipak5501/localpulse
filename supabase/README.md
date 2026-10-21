# Supabase setup for LocalPulse

## 1. Create a project

1. Open [supabase.com](https://supabase.com) and create a free project.
2. Wait until the database is ready.

## 2. Enable anonymous sign-in

**Authentication → Providers → Anonymous Sign-Ins → Enable.**

LocalPulse uses anonymous auth so visitors can post and vote without an email.

## 3. Run the migrations

In the Supabase SQL editor, run both files in order:

1. [`migrations/20261005000000_pulses.sql`](migrations/20261005000000_pulses.sql)
2. [`migrations/20261021000000_create_pulse_rpc.sql`](migrations/20261021000000_create_pulse_rpc.sql)

Or with the CLI (after `npx supabase login` and `npx supabase link`):

```bash
npx supabase db push
```

## 4. Wire the app

Copy `.env.example` → `.env.local` and paste **Project URL** + **anon public** key from
**Project Settings → API**.

```bash
npm run dev
```

The header should say `· live` once location resolves. Without env vars the app stays in demo mode.

## 5. Deploy (GitHub Pages)

Add repository secrets (Settings → Secrets and variables → Actions):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The deploy workflow already passes them into the static build.
