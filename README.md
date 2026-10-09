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
