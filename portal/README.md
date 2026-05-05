This is the **Roof Report Admin Web Portal** — the desktop companion to the
mobile app in the parent directory of this folder. It is a [Next.js](https://nextjs.org)
project that talks to the same Supabase backend as the phone app.

## Layout

```
RoofInspector/         <- mobile app (Expo / React Native)
└── portal/            <- you are here
    ├── src/
    └── package.json
```

PDF rendering shares its HTML template with the mobile app via a port of
`mobile/src/services/report.ts` at `portal/src/lib/reportHtml.ts`. Keep them
in lockstep when changing the report layout.

## Getting Started

### 1. Install

```bash
cd portal
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Same project the mobile app uses |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only; used by API routes |
| `RESEND_API_KEY` | for email | Required to email PDFs to customers |
| `EMAIL_FROM` | for email | e.g. `noreply@your-domain.com` |
| `GOOGLE_MAPS_API_KEY` | optional | Static Maps for the cover satellite image |
| `CHROME_EXECUTABLE_PATH` | local dev only | Path to Chrome/Edge if auto-detect fails |

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

PDF generation requires Chromium. In local dev the launcher
([src/lib/pdf.ts](src/lib/pdf.ts)) auto-detects Chrome/Edge from common install
paths or honours `CHROME_EXECUTABLE_PATH`. In serverless environments (Vercel,
Netlify, Lambda) it uses `@sparticuz/chromium-min` automatically.

## Deploying

### Vercel (recommended)

1. Import the repo (set the **Root Directory** to `portal`).
2. Add the environment variables from step 2 above.
3. Deploy. The PDF API routes set `maxDuration = 60` and `runtime = 'nodejs'`,
   which Vercel honours on the Hobby and Pro plans.

### Other Node hosts

Any Node 20+ host that can run `next start` works. Make sure the host can
download / unpack Chromium at cold-start time (~50 MB).

## Keeping mobile + portal PDFs in sync

The branded HTML template lives in two places:

- Mobile: [`../src/services/report.ts`](../src/services/report.ts)
- Portal: [`src/lib/reportHtml.ts`](src/lib/reportHtml.ts)

These are intentionally kept in lockstep. When you change one (CSS, layout,
section order), apply the equivalent change to the other so a PDF generated
on the phone is byte-identical to one generated from the portal.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
