# Planning Poker Starter for Supabase + Vercel

This is a full-stack starter for a no-login planning poker app using:
- Next.js App Router
- Vercel deployment
- Supabase Postgres
- Serverless API routes
- Client-side polling for room updates

## Setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Fill in your Supabase keys.
5. Run:
   - `npm install`
   - `npm run dev`

## Environment variables
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Deploy
Push the repo to GitHub and import it into Vercel.
Add the same environment variables in Vercel.
