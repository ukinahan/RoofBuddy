# RoofBuddy Admin Web Portal — Scope (v0)

## Goal

Office admins (non-inspectors) need to **review, edit, print and email**
inspection reports created in the RoofBuddy mobile app, without using a phone.

Same Supabase backend → no separate database, no separate auth.

---

## User stories (v1)

1. **Sign in** — Office admin signs in with the *same* email they use on the
   phone (or is invited by an inspector). One account = one company tenant.
2. **Browse jobs** — See a list of all inspections sorted by most-recent. Filter
   by status, customer, severity, date range. Search by address / customer name.
3. **Open inspection** — View full inspection: customer details, all photos with
   markup, notes, severity, measurements, quote line items.
4. **Edit** — Fix typos, change quote line items / pricing, adjust severity,
   tweak notes. Cannot add new photos (camera-only on mobile).
5. **Print** — Generate the same PDF the mobile app generates and download it.
6. **Email** — Send the PDF to the customer (and CC themselves) directly from
   the browser, with a templated body.
7. **Customers** — CRUD on customers (currently customer records originate on
   mobile; admin should be able to clean up / merge duplicates).

## Out of scope (v1)

- Capturing or annotating new photos on web (mobile-only)
- Multi-user team accounts with separate roles (single owner per tenant)
- Stripe billing / subscription management
- Map/route planning for inspectors
- Live notifications

## Tech choices

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | **Next.js 15** (App Router) | SSR for fast first paint, file-based routing, excellent Vercel deploy |
| Language | TypeScript | Match mobile codebase |
| Hosting | **Vercel** (free Hobby tier OK to start) | Zero-config Next.js deploy, preview URLs per PR |
| Auth | `@supabase/ssr` magic-link / OTP | Same Supabase project = same users automatically |
| Data | Supabase JS client (server + client) | RLS already enforces user_id scoping |
| PDF | Server-side render with **`@react-pdf/renderer`** *or* port `report.ts` HTML → headless Chromium via **`puppeteer-core` + `@sparticuz/chromium`** | HTML port is simpler, identical output |
| Email | **Resend API** (already configured) | Same domain `roofinspector.app` |
| UI | Tailwind CSS + shadcn/ui | Quick, consistent, accessible |
| Photo display | Supabase Storage signed URLs (bucket `photos`) | Already populated by mobile auto-sync |

## Architecture

```
Browser
   │ (HTTPS)
   ▼
Vercel (Next.js)
   │
   ├── /login              ──► Supabase Auth (OTP via Resend)
   ├── /                   ──► Inspections list
   ├── /inspections/[id]   ──► Inspection detail / editor
   ├── /customers          ──► Customer list / edit
   ├── /api/pdf/[id]       ──► Returns inspection PDF
   └── /api/email/[id]     ──► Sends PDF to customer
              │
              ▼
       Supabase (existing)
       ├── auth.users
       ├── public.inspections     (jsonb data)
       ├── public.customers       (jsonb data)
       ├── public.company_profiles
       └── storage: photos bucket
```

## Data model — no changes needed

The mobile app already writes:
- `inspections.data` — full Inspection JSON
- `customers.data` — full Customer JSON
- `company_profiles.data` — Company profile JSON
- `photos` Storage bucket — `<userId>/<photoId>.jpg`

The web app reads these directly. RLS policy (`user_id = auth.uid()`) already
keeps tenants isolated.

## Sync model

- **Mobile → Web:** photos auto-sync on app launch / foreground. Admin sees
  changes within minutes of inspector finishing on-site.
- **Web → Mobile:** when admin edits an inspection JSON, mobile pulls the new
  version next time the inspector opens the app (auto-sync on foreground).
- Conflict resolution stays last-write-wins on `updated_at`.

## Estimated effort

Rough breakdown (single dev, focused):

| Slice | Days |
|-------|------|
| Project bootstrap (Next 15 + Supabase SSR + Tailwind + login) | 0.5 |
| Inspections list page + filtering | 0.5 |
| Inspection detail viewer (photos, notes, drawings) | 1 |
| Inspection editor (notes, severity, quote line items) | 1 |
| PDF render endpoint + download button | 1 |
| Email send endpoint + recipient form | 0.5 |
| Customers CRUD | 0.5 |
| Polish, mobile-responsive layout, error states | 1 |
| Deploy + custom domain (`admin.roofinspector.app`) | 0.5 |
| **Total** | **~6.5 days** |

## Cost

| Item | Cost |
|------|------|
| Vercel Hobby | Free (100 GB bandwidth/mo) |
| Supabase Free | Free until 500 MB DB / 1 GB storage / 50k MAU |
| Resend Free | Free until 3k emails/mo, 100/day |
| Domain (`admin.roofinspector.app`) | Free — uses existing domain |
| **Total to launch** | **$0/mo** until you grow |

## Open questions

1. **Single user vs. team?** Currently the mobile app's auth model is one
   account = one company. If office admin is a *different* person to the
   inspector, they need to share the inspector's login *or* we add a tenant
   model with team members. Recommend v1 = shared login, v2 = teams.
2. **Editing drawings?** Re-rendering SVG annotations is straightforward, but
   editing them on web requires a canvas drawing tool. Recommend v1 = view
   only; admin can add a free-text "office note" instead.
3. **Audit log?** Should every edit be logged for compliance? Easy to add
   (insert into a new `audit_log` table on every update). Recommend v1 = no,
   v2 = yes if any contractors flag it as a need.
4. **Public customer link?** Should admin be able to share a read-only
   customer-facing link to a report (no login required) instead of emailing
   the PDF? Nice-to-have for v2.

## Next step

If approved: scaffold the Next.js project under
`C:\Users\kinahanultan\RoofInspectorAdmin` (separate repo, separate Vercel
project, deploys to `admin.roofinspector.app`).
