# decoshop-planv2

Interactive 2D floor plan editor for **DecoShop Toulouse**. Manage store sections, shelves, and product placement with a click-through drill-down interface.

## Features

- **Two Modes**: Structure (drag/resize sections) & Inventory (manage products)
- **Drill-Down Navigation**: Store → Section → Shelf → Products
- **Real Data**: 14 sections, 6 functional zones, 250+ product suggestions
- **Supabase Backend**: Persistent storage with PostgreSQL
- **TypeScript Strict**: Zero `any`, full type coverage

## Quick Start

```bash
npm install
cp .env.example .env.local  # Fill in Supabase credentials
npm run dev
```

## Tech Stack

- Vite + React 19 + TypeScript (strict)
- Supabase (PostgreSQL)
- Vanilla CSS (DM Sans + Playfair Display)

## Database

Run `sql/001_plan_tables.sql` in Supabase SQL Editor to create the plan tables.
This migration is **additive** — it will not affect existing tables.
