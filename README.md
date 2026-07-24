# 🥮 Kamai OMS (Baker's Cockpit & Wholesale Engine)

### *The Mobile-First Operating System & Digital Escrow for India's Independent Home Bakers & Local Wholesalers*

[Overview](#-overview) • [Core Architecture](#-core-architecture) • [Screen Directory](#-screen-directory) • [Financial & Gateway Model](#-financial--gateway-model) • [Database Schema](#-database-schema-ddl) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started)

---

## 🚀 Overview

**Kamai OMS (Baker's Cockpit & Wholesale Engine)** is a high-performance, mobile-first Progressive Web Application (PWA) built to solve the operational chaos faced by independent home bakers and micro-entrepreneurs across India. Independent bakers lose up to **30% of their margins** to administrative friction—untracked raw material costs, lost UPI advances, and messy WhatsApp scheduling. Kamai replaces fragmented notebooks and endless chat threads with an integrated digital operating cockpit, automated margin auditing, secure digital escrow, and wholesale pre-order queue-busting.

---

## 🏛️ Core Architecture: One App, Two Frontends

Kamai operates on a unified Next.js codebase deploying **two distinct frontend interfaces** connected to a single centralized PostgreSQL relational database (Supabase):

1. **The Baker's Cockpit (Demand Side):** Mobile PWA for home bakers to log orders, track production schedules, manage customer directories, and auto-generate WhatsApp receipts.
2. **The Wholesale Engine (Supply Side):** Portal for local merchants/wholesalers to manage bulk demand pipelines, static catalogs, and QR code-enabled flash pickups without live inventory tracking.

```
┌────────────────────────────────────────────────────────┐
│               Unified Next.js PWA                      │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │  Baker's Cockpit UI  │    │ Wholesale Engine UI  │  │
│  └──────────┬───────────┘    └──────────┬───────────┘  │
│             │                           │              │
└─────────────┼───────────────────────────┼──────────────┘
              ▼                           ▼
            ┌───────────────────────────────┐
            │      Supabase PostgreSQL      │
            └───────────────────────────────┘
```

---

## 📱 19-Screen Architecture Directory

The application is structured into **19 responsive views** optimized for mobile-first touch targets and smooth overlay modals:

| Module | Screens | Description |
| :--- | :--- | :--- |
| **Auth & Onboarding** | 1–2 | Mobile number input & Authkey SMS OTP instant tenant provisioning. |
| **Core Order Engine** | 3–6 | Summary Dashboard, New Order Form modal, Order History Pipeline, Order Details & 1-click WhatsApp receipt generator. |
| **CRM & Scheduling** | 7–9 | Customer Directory (LTV sorting), Customer Profile, Active Production Tracking calendar. |
| **Finance & Sourcing** | 10–13 | Investment Ledger & Bi-directional cost calculator, Subscription Billing (Razorpay), Wholesale Marketplace Hub, Supplier / Product Details modal. |
| **Admin & Settings** | 14–19 | Profile & FSSAI Verification, Manage UPI (VPA settings), AutoPay & Subscription Management (Razorpay), Support Help Desk, Legal & Compliance. |

---

## 💳 Financial & Gateway Economics

### 1. 90-Day Conversion Lifecycle Strategy

* **Day 1 (Zero-Friction Signup):** Instant login via SMS OTP. System sets `trial_ends_at = NOW() + INTERVAL '90 days'` and flags `is_early_adopter = TRUE` with zero payment friction.
* **Days 1–83 (Full Engagement):** Baker builds operational dependency logging orders and sending WhatsApp receipts for free.
* **Day 84 (In-App Nudge):** Persistent Next.js UI banner highlights remaining trial days and locks in the **₹149/month** early adopter rate.
* **Day 91 (Paywall Activation):** Next.js Middleware redirects to `/billing` requiring Razorpay UPI AutoPay setup to retain access.

### 2. Pricing & Take-Home Margins

* **Early Adopter Plan:** ₹149 / month (3 Months Free trial, then recurring via Razorpay UPI AutoPay). Net creator revenue ~₹143.75 after TDR, subscription engine fees, and GST.
* **Pro Plan (Coming Soon):** ₹299 / month for scaling home bakeries with multi-staff access and priority wholesale routing.
* **Wholesale Convenience Fee:** 0% commission charged to wholesalers; a flat ₹10–₹15 convenience fee charged to bakers per wholesale escrow order to skip physical lines.

---

## 🗄️ Database Schema (Relational Model DDL)

Core PostgreSQL tables powering the multi-tenant architecture:

* `bakers`: Tenant metadata, phone, business_name, FSSAI license verification status.
* `customers`: Customer directory linked per baker, tracking order counts, lifetime spend (`total_spent`), and last order dates.
* `orders`: Order lifecycle tracking (`draft`, `in_production`, `ready`, `delivered`), advance payments, balance due, and compressed base64 cake photos (`cake_photo TEXT`).
* `investments`: Raw material procurement records with bi-directional cost tracking (`material_name`, `unit`, `price_per_unit`, `quantity`).
* `profit_bank`: Cash inflow and outflow ledger (`amount`, `type`, `mode`, `transaction_date`).

---

## 🛠️ Tech Stack & Infrastructure

* **Framework:** Next.js (App Router, Server Actions, PWA Service Workers)
* **Database & Auth:** Supabase (PostgreSQL, Row Level Security, PgBouncer pooling)
* **Styling & UI:** Tailwind CSS with custom Design System (Deep Charcoal Slate `#0F172A`, Vibrant Escrow Mint `#10B981`, Ivory Mist `#FFFBEB`)
* **Payments & Escrow:** Razorpay Subscriptions (UPI AutoPay) & Zero-MDR UPI Routing
* **SMS Gateway:** Authkey.io (Startup Credits integration)
* **Hosting & CDN:** Vercel (Hobby Tier) & Cloudflare (Free Tier)

---

## 🛠️ Getting Started Locally

1. **Clone the Repository:**

```bash
git clone https://github.com/anynomous001/Kamai_OMS_frontend.git
cd Kamai_OMS_frontend
```

2. **Install Dependencies:**

```bash
npm install
```

3. **Configure Environment Variables:**

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
AUTHKEY_API_KEY=your_authkey_api_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

4. **Run the Development Server:**

```bash
npm run dev
```

Open http://localhost:3000 to view the PWA cockpit in action.

---

## 📄 License

This project is proprietary and confidential. Built for the Vande Bharatam grassroots economic initiative.
