# Sunday Harmony — Admin & Client Dashboard Plan

## Overview
Add two authenticated dashboard areas to the Next.js site:
- **Admin Dashboard** (`/admin`) — Sunday Harmony's internal business command center with all toolkit tools
- **Client Dashboard** (`/dashboard`) — where clients log in to see their performance, deliverables, and package info

## Authentication
- **NextAuth.js** with credentials provider (email/password)
- Two roles: `admin` and `client`
- Admin accounts seeded via environment variable or database
- Client accounts created by admin from the admin dashboard
- Passwords hashed with bcrypt
- Session-based auth with JWT tokens
- Protected routes via Next.js middleware

## Database
- **JSON file storage** to start (no external DB dependency — works immediately)
- `data/users.json` — user accounts (admin + clients)
- `data/leads.json` — contact form submissions
- `data/clients.json` — client profiles, packages, notes
- Easy to migrate to a real database (Prisma + PostgreSQL) later

---

## Phase 1: Admin Dashboard

### Pages & Features

**`/admin` — Overview**
- Lead count (new, contacted, converted)
- Active client count + total MRR
- Revenue breakdown by package tier
- Recent form submissions
- Quick-action buttons

**`/admin/leads` — Lead Management**
- Table of all contact form submissions
- Status column: New → Contacted → Audit Sent → Proposal → Won / Lost
- Click to view full submission details
- Add notes to each lead
- Convert lead to client (creates client account)

**`/admin/clients` — Client Management**
- List of active clients with package tier, start date, status
- Click to view/edit client details
- Assign package, set deliverables, add notes
- Create client login credentials

**`/admin/revenue` — Revenue Calculator**
- Port the toolkit's revenue calculator (sliders for each tier)
- Show actual revenue from real client data alongside projections
- Preset scenarios (Conservative / Moderate / Ambitious)
- Annual projection

**`/admin/roadmap` — 90-Day Roadmap**
- Port the toolkit's 4-phase roadmap (Week 1-2, 3-4, 5-8, 9-12)
- Daily task breakdowns with checkboxes (persistent)
- Milestone tracking with KPIs
- Progress indicators per phase

**`/admin/competitors` — Competitive Analysis**
- Competitor landscape map (visual scatter plot)
- Deep-dive profiles for all 6 competitors
- Market gaps & vulnerabilities grid
- Positioning canvas (editable text fields, saved)

**`/admin/outreach` — Outreach & Scripts**
- 7 acquisition channels with priority levels and how-to guides
- 4 outreach script templates (Cold DM, Walk-In, Follow-Up, Referral)
- Copy-to-clipboard on each script
- Conversion funnel visualization
- Weekly activity targets

**`/admin/discovery` — Customer Discovery**
- Interview script with expandable coaching notes
- Prospect finder (6 industry verticals)
- Pro tips section

---

## Phase 2: Client Dashboard

### Pages & Features

**`/dashboard` — Client Home**
- Welcome message with client name + business
- Their current package with included services
- Quick wins delivered (checklist)
- Next deliverable / upcoming actions

**`/dashboard/performance` — Performance Snapshot**
- Monthly metrics cards (placeholder data for now)
- Service activity log (what was done this month)
- Before/after comparisons area

**`/dashboard/package` — My Package**
- Current package details with full feature list
- Add-on options
- Upgrade path visualization

**`/dashboard/messages` — Messages**
- Simple message thread between client and Sunday Harmony
- Client can submit requests or questions
- Admin sees messages in admin dashboard

**`/dashboard/billing` — Billing**
- Current plan and monthly cost
- Invoice history (placeholder)
- Payment status

---

## File Structure (new files)

```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx          # Admin shell (sidebar nav)
│   │   ├── page.tsx            # Admin overview
│   │   ├── leads/page.tsx      # Lead management
│   │   ├── clients/page.tsx    # Client management
│   │   ├── revenue/page.tsx    # Revenue calculator
│   │   ├── roadmap/page.tsx    # 90-day roadmap
│   │   ├── competitors/page.tsx # Competitive analysis
│   │   ├── outreach/page.tsx   # Scripts & channels
│   │   └── discovery/page.tsx  # Customer discovery tools
│   ├── dashboard/
│   │   ├── layout.tsx          # Client shell (sidebar nav)
│   │   ├── page.tsx            # Client home
│   │   ├── performance/page.tsx
│   │   ├── package/page.tsx
│   │   ├── messages/page.tsx
│   │   └── billing/page.tsx
│   ├── login/page.tsx          # Shared login page
│   └── api/
│       ├── auth/[...nextauth]/route.ts  # NextAuth
│       ├── admin/
│       │   ├── leads/route.ts
│       │   ├── clients/route.ts
│       │   └── messages/route.ts
│       └── dashboard/
│           ├── messages/route.ts
│           └── profile/route.ts
├── lib/
│   ├── auth.ts                 # NextAuth config
│   ├── db.ts                   # JSON file database helpers
│   └── toolkit-data.ts         # All toolkit content (phases 1-5)
├── components/
│   ├── admin/
│   │   ├── AdminSidebar.tsx
│   │   ├── LeadTable.tsx
│   │   ├── ClientTable.tsx
│   │   ├── RevenueCalc.tsx
│   │   ├── RoadmapTracker.tsx
│   │   ├── CompetitorMap.tsx
│   │   ├── OutreachScripts.tsx
│   │   └── DiscoveryTools.tsx
│   ├── dashboard/
│   │   ├── ClientSidebar.tsx
│   │   ├── PackageCard.tsx
│   │   ├── PerformanceCards.tsx
│   │   ├── MessageThread.tsx
│   │   └── BillingInfo.tsx
│   └── ui/
│       ├── StatusBadge.tsx
│       ├── DataTable.tsx
│       └── StatCard.tsx
└── middleware.ts               # Route protection
```

## Implementation Order
1. Auth system (NextAuth + middleware + login page)
2. JSON database layer
3. Admin layout + overview page
4. Admin lead management (+ update contact form API to save leads)
5. Admin client management
6. Admin toolkit pages (revenue, roadmap, competitors, outreach, discovery)
7. Client layout + home page
8. Client dashboard pages (performance, package, messages, billing)
9. Admin-client messaging system
