# ⚽ El Contragolpe

**Football prediction game for restaurants and bars.** Customers make predictions from their table during live matches, compete on a real-time leaderboard, and unlock bonus predictions by ordering menu items.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
  - [1. Clone & Install](#1-clone--install)
  - [2. Create Supabase Project](#2-create-supabase-project)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Run Database Migrations](#4-run-database-migrations)
  - [5. Enable Anonymous Auth](#5-enable-anonymous-auth)
  - [6. Create Admin User](#6-create-admin-user)
  - [7. Start Development Server](#7-start-development-server)
- [Usage Guide](#usage-guide)
  - [Admin Flow](#admin-flow)
  - [Player Flow](#player-flow)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

El Contragolpe turns any sports bar or restaurant into an interactive prediction arena. While a football match is on TV, customers scan a QR code, join from their table, and make predictions like "Who wins?", "Next goalscorer?", or "How many goals?". The admin controls the match lifecycle and records results in real-time, automatically scoring predictions and updating the leaderboard.

**Key differentiator:** Bonus predictions are unlocked when a table orders specific menu items — gamifying food and drink sales.

---

## Features

### 🎮 For Players
- **Quick join** — Scan QR code → Enter name → Select table → Play
- **Anonymous auth** — No sign-up required, no email or phone needed
- **Multiple-choice predictions** — Tap to select from predefined options
- **Real-time leaderboard** — See your ranking update live
- **Table vs. Table** — Compete as a table, not just individually
- **Bonus predictions** — Unlock extra questions when your table orders specific items

### 🔧 For Admins
- **Match lifecycle** — Draft → Open → Live → Finished → Archived
- **Prediction builder** — Create questions with up to 6 answer options
- **One-click results** — Record the correct answer by tapping a button
- **"Nadie ganó" option** — Built-in option when no one predicted correctly
- **Live score updates** — Update the scoresheet during the match
- **Table & Menu management** — Manage restaurant tables and menu items
- **Bonus activation** — Unlock bonus predictions when tables order items
- **Dual leaderboard** — View rankings by player or by table

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 13.5** | React framework (App Router) |
| **TypeScript** | Type safety |
| **Supabase** | Database (PostgreSQL), Auth, Realtime |
| **Vanilla CSS** | Custom design system (dark football theme) |
| **Vercel** | Deployment (recommended) |

---

## Project Structure

```
elContragolpe/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Home page
│   │   ├── layout.tsx                  # Root layout (imports globals.css)
│   │   ├── globals.css                 # Complete design system
│   │   ├── join/
│   │   │   └── page.tsx                # Player onboarding (name → table → consent)
│   │   ├── play/
│   │   │   ├── waiting/page.tsx        # Waiting room (no active match)
│   │   │   └── [matchId]/page.tsx      # Player match view (predictions + leaderboard)
│   │   └── admin/
│   │       ├── page.tsx                # Admin login
│   │       ├── layout.tsx              # Admin sidebar layout
│   │       ├── dashboard/page.tsx      # Dashboard overview
│   │       ├── matches/
│   │       │   ├── page.tsx            # Match list
│   │       │   └── [matchId]/page.tsx  # Match control panel
│   │       ├── tables/page.tsx         # Table management
│   │       ├── menu/page.tsx           # Menu item management
│   │       └── history/page.tsx        # Match history
│   ├── lib/
│   │   ├── supabase.ts                # Supabase client initialization
│   │   └── auth.ts                    # Auth helper functions
│   └── types/
│       └── database.ts                # TypeScript type definitions
├── supabase/
│   ├── 001_schema.sql                 # Database schema (tables, functions, triggers)
│   ├── 002_rls_policies.sql           # Row Level Security policies
│   ├── 003_seed.sql                   # Demo data (restaurant, tables, menu items)
│   └── 004_add_options.sql            # Migration: prediction answer options
├── .env.local.example                 # Environment variable template
├── package.json
├── tsconfig.json
└── next.config.js
```

---

## Prerequisites

- **Node.js** 18+ and **npm**
- A **Supabase** account (free tier works) → [supabase.com](https://supabase.com)
- (Optional) **Vercel** account for deployment → [vercel.com](https://vercel.com)

---

## Setup Guide

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd elContragolpe
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Name it **"El Contragolpe"** (or whatever you prefer)
4. Set a **database password** (save it somewhere safe)
5. Choose the region closest to your users
6. Wait for the project to finish provisioning (~1 minute)

### 3. Configure Environment Variables

1. In your Supabase project, go to **Settings → API**
2. Copy **Project URL** and **anon/public key**
3. Create `.env.local` in the project root:

```bash
cp .env.local.example .env.local
```

4. Edit `.env.local` and fill in the values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...YOUR_ANON_KEY_HERE
```

> ⚠️ Both variables must start with `NEXT_PUBLIC_` to be accessible in the browser.

### 4. Run Database Migrations

In Supabase Dashboard, go to **SQL Editor** and run these scripts **in order**:

#### Script 1: Schema (`001_schema.sql`)
Creates all tables: `restaurants`, `tables`, `matches`, `prediction_types`, `predictions`, `match_results`, `table_bonuses`, `menu_items`, `players`.

Also creates:
- Auto-scoring trigger for predictions
- `updated_at` timestamp trigger

#### Script 2: RLS Policies (`002_rls_policies.sql`)
Creates Row Level Security policies and the `is_restaurant_admin()` function.

#### Script 3: Seed Data (`003_seed.sql`)
Creates a demo restaurant with:
- Slug: `demo`
- 5 sample tables (Terraza 1, Terraza 2, Barra, Mesa Roja, VIP)
- 3 menu items (Nachos Especiales, Jarra de Cerveza, Alitas BBQ)

#### Script 4: Options Migration (`004_add_options.sql`)
Adds the `options` JSONB column for multiple-choice predictions.

**How to run each script:**
1. Open the SQL file in your code editor
2. Copy the entire content
3. Go to Supabase Dashboard → **SQL Editor** → click **"New Query"**
4. Paste and click **"Run"**
5. Repeat for each file in order (001 → 002 → 003 → 004)

### 5. Enable Anonymous Auth

Supabase anonymous auth allows players to join without creating an account.

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Scroll down to find **"Anonymous Sign-Ins"**
3. **Enable** the toggle
4. Click **Save**

> This is essential! Without this, players won't be able to join the game.

### 6. Create Admin User

This is the most important step. The admin user needs specific metadata to access the dashboard.

#### Step A: Create the Auth User

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Click **"Add User"** → **"Create New User"**
3. Fill in:
   - **Email:** `admin@elcontragolpe.com` (or your preferred email)
   - **Password:** Choose a strong password
   - **Auto Confirm User:** ✅ Check this box
4. Click **"Create User"**
5. **Copy the user's UUID** from the user list (click on the user to see it)

#### Step B: Get the Restaurant ID

Go to **SQL Editor** and run:

```sql
SELECT id, name, slug FROM restaurants;
```

Copy the `id` of the restaurant you want to assign the admin to (e.g., `00000000-0000-0000-0000-000000000001` for the demo restaurant).

#### Step C: Assign Admin Role

In **SQL Editor**, run this query (replace the placeholders):

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
    'role', 'restaurant_admin',
    'restaurant_id', 'YOUR_RESTAURANT_ID_HERE'
)
WHERE id = 'YOUR_USER_UUID_HERE';
```

**Example with real values:**

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
    'role', 'restaurant_admin',
    'restaurant_id', '00000000-0000-0000-0000-000000000001'
)
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

#### Step D: Verify

Run this to confirm the metadata was set correctly:

```sql
SELECT id, email, raw_app_meta_data
FROM auth.users
WHERE email = 'admin@elcontragolpe.com';
```

You should see:
```json
{
  "provider": "email",
  "providers": ["email"],
  "role": "restaurant_admin",
  "restaurant_id": "00000000-0000-0000-0000-000000000001"
}
```

#### Creating Additional Admin Users

Repeat steps A–C for each admin. You can have multiple admins per restaurant, or different admins for different restaurants.

For a **super admin** (access to all restaurants), use `'super_admin'` instead of `'restaurant_admin'`:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
    'role', 'super_admin'
)
WHERE id = 'YOUR_USER_UUID_HERE';
```

### 7. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Player page:** [http://localhost:3000/join](http://localhost:3000/join)
- **Admin login:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## Usage Guide

### Admin Flow

1. **Log in** at `/admin` with your admin email and password
2. **Create a match** → Go to **Matches** → Click **"+ New Match"** → Enter team names
3. **Add prediction types** → Click on the match → **📋 Types** tab:
   - Enter the question (e.g., "¿Quién gana?")
   - Add answer options (e.g., "Madrid", "Barcelona", "Empate")
   - Set points value
   - Optionally mark as bonus prediction
4. **Open the match** → Click **"🟢 Open for Predictions"** — players can now join and predict
5. **Start the match** → Click **"🔴 Start Match (Go Live)"** when the real match kicks off
6. **Update the score** → Use the score widget that appears during live and finished states
7. **Record results** → Go to **✅ Results** tab → Click the correct option for each prediction
   - Click **"Nadie ganó"** if no answer is correct
   - Results auto-score all player predictions
8. **View leaderboard** → **🏆 Board** tab → Toggle between **👤 Players** and **🪑 Tables**
9. **End the match** → Click **"🏁 End Match"** → then **"📦 Archive"** when ready

### Player Flow

1. **Scan QR code** or visit `/join?r=demo` (replace `demo` with your restaurant slug)
2. **Enter your name** → This appears on the leaderboard
3. **Select your table** → Pick from the list or create a new one
4. **Accept privacy terms** → Minimal data collection notice
5. **Make predictions** → Tap on answer buttons to submit predictions
6. **View leaderboard** → Switch to **🏆 Ranking** tab → Toggle **👤 Jugadores** / **🪑 Mesas**
7. **Wait for results** → Admin records results, auto-scoring happens in real-time

### Bonus Predictions

1. Admin creates a prediction marked as **"bonus"** linked to a menu item
2. Prediction is **hidden** from players by default
3. When a table orders that menu item, admin goes to **⭐ Bonuses** tab
4. Admin selects the table + menu item → clicks **"Activate Bonus"**
5. The bonus prediction **instantly appears** for all players at that table (via realtime)

---

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **"New Project"**
3. Import your GitHub repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **"Deploy"**

### QR Codes for Tables

Generate QR codes that link to:
```
https://your-domain.vercel.app/join?r=YOUR_RESTAURANT_SLUG
```

Each restaurant has a unique slug (e.g., `demo`). Players scanning the QR code will be taken directly to the join page for that restaurant.

You can generate QR codes using any free service like [qr-code-generator.com](https://www.qr-code-generator.com/).

---

## Troubleshooting

### "Restaurant not found" on join page
- Check that the `?r=` parameter matches a `slug` in the `restaurants` table
- Default slug is `demo` if no parameter is provided

### Admin login fails
- Verify the user was created with **Auto Confirm User** enabled
- Check that `raw_app_meta_data` contains `role` and `restaurant_id`
- Run the verification SQL query from Step 6D above

### Styling looks broken (white background)
- Clear the Next.js cache: `rm -rf .next && npm run dev`
- Hard refresh: `Ctrl + Shift + R`

### Players can't submit predictions
- Check match status is `open` or `live` (not `draft`)
- Verify the prediction type exists for that match
- For bonus predictions, verify the bonus is activated for their table

### Realtime updates not working
- In Supabase Dashboard → **Database** → **Replication**, enable realtime for:
  - `predictions`
  - `match_results`
  - `matches`
  - `table_bonuses`

### Port already in use
- If port 3000 is occupied, Next.js will try 3001 automatically
- To kill existing processes: `lsof -ti:3000 | xargs kill -9`

---

## Database Schema

### Core Tables

| Table | Description |
|---|---|
| `restaurants` | Restaurants/bars using the platform |
| `tables` | Physical tables in each restaurant |
| `matches` | Football matches with status lifecycle |
| `prediction_types` | Questions for each match (with answer options) |
| `predictions` | Player answers to prediction types |
| `match_results` | Actual results recorded by admin |
| `players` | Players (anonymous auth, linked to table) |
| `menu_items` | Food/drink items that trigger bonuses |
| `table_bonuses` | Records of bonus activations per table |

### Match Status Lifecycle

```
draft → open → live → finished → archived
```

- **draft** — Match created, not yet visible to players
- **open** — Players can join and make predictions
- **live** — Match in progress, predictions still allowed
- **finished** — Match ended, results being recorded
- **archived** — All done, stored for history

---

## License

Private project — All rights reserved.

---

Built with ❤️ and ⚽ by the El Contragolpe team.
