# Hungry Nomad

Food ordering web app for Hungry Nomad in Kaduna. Customers browse the menu, check out with Paystack, and track an order by id and phone. Staff work happens in the separate hungry-nomad-admin app.

## Tech stack

- Next.js 14 (App Router) and TypeScript
- Tailwind CSS
- Supabase
- Paystack
- Resend, optional Termii SMS
- Vercel

## Features

- Menu categories: fast food, regular dishes, Chinese, ice cream, beverages
- Cart, delivery zones, server-computed totals
- Paystack payment with webhook and return-page verification
- Sold-out items (`products.is_available`) and a kitchen note on the order
- Opening hours read from `store_settings`, with an immediate closed override

## Setup

```bash
git clone https://github.com/general-Dee/hungry-nomad.git
cd hungry-nomad
npm install
cp .env.example .env.local
npm run dev
```

Paste `docs/sql` and the admin repo migrations into the Supabase SQL editor before expecting sold-out, notes, or editable hours to work.

## Order lookup (read-only GitHub Action)

`.github/workflows/order-lookup.yml` looks up a single order from GitHub's
runners, using the same `SUPABASE_DB_URL` repository secret (Session pooler)
as the nightly DB export. It is manual-only (`workflow_dispatch`), runs exactly
one `SELECT` on `public.orders` inside a `BEGIN TRANSACTION READ ONLY`
transaction, and never writes to the database.

```bash
gh workflow run order-lookup.yml -f order_id=98
gh run watch "$(gh run list --workflow=order-lookup.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

`order_id` must be digits only (1-9 characters). The job log shows the id,
customer name, masked phone (first 4 + last 2 digits), masked email
(`ad***@example.com`), total, status, created time and payment reference. While
this repository is public, job logs are publicly readable, so the name is cut
to first name + last initial and the payment reference to its last 4
characters. The connection string is never printed.
