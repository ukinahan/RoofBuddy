# RoofBuddy

A mobile app for roof inspectors and surveyors. Capture photos on-site, annotate damage,
measure problem areas directly on each photo, and generate branded PDF reports + customer
quotes — all offline.

iOS only at present (Android pipeline configured but not actively shipped).

---

## What it does today

- **Inspections** — create site visits keyed to a customer + property address
- **Customers** — lightweight CRM (name, contact, address, notes, history)
- **Photo capture** — full-screen landscape camera, photos auto-resized to 1600px
  JPEG so the report layout is consistent
- **Annotation** — draw freehand / rectangles / circles / arrows on each photo with
  selectable colour and stroke. Toolbar is horizontally scrollable so every shape
  tool is reachable on smaller screens
- **On-photo measurement** — calibrate scale once against a known reference (e.g. a
  brick course), then measure linear distances and rectangular areas. Results render
  in metric or imperial based on locale
- **Quote builder** — line-item quotes with VAT, deposit %, and a "Pull from Photos"
  button that turns measured areas/lengths into draft quote lines
- **Branded PDF report** — multi-page output: cover, project overview, satellite
  thumbnail, photos with overlaid drawings + measurements, conclusion + cost
- **Email / share** — send the report straight from the device via the system mail
  composer or share sheet
- **Localisation** — IE / UK / US / CA / AU / ES with currency, units, and (English)
  UI strings; framework in place for `ga` and `es` translations
- **Optional cloud sync** — magic-link sign-in via Supabase; inspections, customers,
  and photos sync across devices and to the companion web portal. Sync respects a
  WiFi-only setting and a per-photo size cap to keep mobile data usage low. The app
  remains fully usable offline when sync is disabled or unavailable
- **Companion web portal** — sign in at https://admin.roofinspector.app to review,
  edit, PDF, and email reports from a desktop browser. Same data, same account

---

## What it does NOT do (yet)

So you don't get caught out — these are intentionally not in the build:

- AI / automatic damage detection
- Aerial / drone / satellite measurement
- Multi-device sync, cloud backup, or team accounts
- Digital signature / customer approval workflow
- Invoicing or payment processing
- Push notifications
- Web companion app
- QuickBooks / Xero integration

Several of these are on the roadmap; none are present in v1.3.x.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| Navigation | React Navigation v6 (bottom tabs + native stacks) |
| Storage | `@react-native-async-storage/async-storage` (device-local) |
| Camera | `expo-camera` + `expo-image-manipulator` |
| Drawing | `react-native-svg` |
| PDF | `expo-print` (HTML → PDF via WebKit) |
| Maps | Google Maps Static + Geocoding APIs |
| Crash reporting | Sentry (optional, via EAS env var) |
| Build / submit | Expo Application Services (EAS) |

---

## Project structure

```
RoofInspector/
├── App.tsx                              # Root: 4 bottom tabs, each owns a stack
├── app.config.js                        # Dynamic Expo config; reads env vars
├── eas.json                             # EAS build + submit profiles
├── .env.example                         # Template for local secrets
├── src/
│   ├── types/index.ts                   # Shared TS types (Inspection, Photo, Quote, …)
│   ├── services/
│   │   ├── storage.ts                   # AsyncStorage CRUD for inspections
│   │   ├── customers.ts                 # AsyncStorage CRUD for customers
│   │   ├── company.ts                   # Company profile + T&Cs
│   │   ├── locale.ts                    # Region / language / units / currency
│   │   ├── i18n.ts                      # Translation dictionaries + useT() hook
│   │   ├── maps.ts                      # Google Maps geocoding + static images
│   │   ├── report.ts                    # PDF generation (HTML builder)
│   │   └── sentry.ts                    # Optional crash reporting bootstrap
│   ├── screens/
│   │   ├── HomeScreen.tsx               # Inspections tab (list + iPad split view)
│   │   ├── NewInspectionScreen.tsx      # Create inspection form
│   │   ├── InspectionScreen.tsx         # Photo grid + actions for one inspection
│   │   ├── CameraScreen.tsx             # Landscape-locked camera
│   │   ├── PhotoDetailScreen.tsx        # Annotate / measure / calibrate one photo
│   │   ├── ReportScreen.tsx             # Configure + generate PDF report
│   │   ├── QuoteScreen.tsx              # Line-item quote builder
│   │   ├── JobsScreen.tsx               # Date-grouped view of inspections
│   │   ├── CustomersScreen.tsx          # Customers tab list
│   │   ├── CustomerDetailScreen.tsx     # One customer + their inspections + stats
│   │   ├── SettingsScreen.tsx           # Settings tab entry
│   │   ├── CompanyProfileScreen.tsx     # Company name / logo / VAT / T&Cs
│   │   └── SplashScreen.tsx             # Initial branded splash
│   ├── components/
│   │   ├── DrawingCanvas.tsx            # SVG drawing + measurement renderer
│   │   ├── InspectionCard.tsx
│   │   └── PhotoCard.tsx
│   └── utils/responsive.ts              # Tablet/phone breakpoints
└── assets/                              # Icons, splash, default logo
```

---

## Getting started (development)

### Prerequisites

- Node 20 LTS
- An Expo account (`expo.dev`) — free
- iOS device or simulator (Android works but is not the focus)
- A Google Maps API key with **Maps Static API** + **Geocoding API** enabled

### 1. Install dependencies

```powershell
npm install
```

### 2. Configure local secrets

```powershell
Copy-Item .env.example .env
```

Open `.env` and fill in:

```
GOOGLE_MAPS_API_KEY=your-key-here
SENTRY_DSN=                              # optional
```

`.env` is git-ignored. For production builds the same names are stored as EAS
environment variables (`eas env:create production --name GOOGLE_MAPS_API_KEY …`).

### 3. Run on a device

```powershell
npx expo start
```

Open in an iOS simulator (`i`) or scan the QR code with the Expo Go app on a real
device. Note: Expo Go cannot exercise some native modules (camera permission flows
behave differently in dev clients).

---

## Building for TestFlight

```powershell
eas build --platform ios --profile production --auto-submit
```

This:
1. Reads `app.config.js` and bakes in EAS environment variables
2. Builds an `.ipa` on EAS servers (~20 min)
3. Uploads it to App Store Connect for the configured ASC App ID

Bump `version` and/or `buildNumber` in `app.config.js` before each build —
`autoIncrement` is intentionally off because it does not work with `app.config.js`.

---

## Walkthrough

1. **Settings → Company Profile** — set your company name, logo, VAT rate, and T&Cs
2. **Customers tab → +** — add a customer (or skip and create one inline later)
3. **Inspections tab → + New Inspection** — pick the customer, fill in address/ref
4. From the inspection screen, tap **Camera** to capture photos
5. Tap a photo thumbnail to open **Photo Detail**
6. In **Draw mode**:
   - Use 🎯 **Calibrate** first — draw a line over a known reference (e.g. a 1.0 m
     flashing) and enter the real-world length
   - Then use 📏 **Length** or 📐 **Area** to measure features; labels render in
     your locale's units
   - Use ✏️ / ▭ / ○ / → for annotation
7. Set **Severity** and **Inspector Notes** per photo
8. Back on the inspection, tap **Quote** → optionally **Pull from Photos** to seed
   line items from your measurements; set prices
9. Tap **Report** → fill in conditions / overview / conclusion → **Generate PDF**
10. **Email** or **Share** the PDF

---

## Severity levels

| Level   | Colour   | Suggested meaning                |
|---------|----------|----------------------------------|
| High    | Red      | Immediate repair required        |
| Medium  | Orange   | Repair within 3–6 months         |
| Low     | Green    | Monitor / cosmetic               |
| None    | Grey     | Reference photo, no action       |

---

## Data and privacy

- All inspection, photo, and customer data is stored locally in `AsyncStorage`
- Photos are stored as JPEG files in the app's Documents directory (and optionally
  copied to the device Photos library if enabled in Company Profile)
- The only outbound network calls in the app are to Google Maps (for the satellite
  thumbnail and address geocoding) and, if configured, Sentry
- There is no backend, no account system, and no analytics
- Device loss = data loss. Use **Settings → Export Data** to back up regularly

---

## Recent changes

- **v1.4.1 (build 24)** — Drawing toolbar now scrolls horizontally so the Area
  tool and any tools beyond it are reachable on narrower devices. README +
  documentation refresh covering the cloud-sync, onboarding, sync-prefs, and
  companion-portal work that landed in the v1.4.0 line
- **v1.4.0 (build 23)** — Optional cloud sync via Supabase: magic-link sign-in,
  inspection + customer + photo sync, true WiFi-only detection (`expo-network`),
  per-photo size cap, sync progress bar, background sync on app foreground.
  Onboarding updated with a cloud-backup explainer card. Photo URI resolution
  rebuilt to survive iOS app-container UUID rotation so historical reports keep
  their images. Companion web portal (Next.js on Vercel) now live at
  https://admin.roofinspector.app
- **v1.3.2 (build 20)** — Photo aspect-ratio fix: capture pipeline standardises
  every photo to 1600 px landscape, drawing canvas matches actual photo aspect,
  removed `scaleY(1.1)` PDF stretch, SVG overlay now uses
  `preserveAspectRatio="xMidYMid meet"` so markups stay aligned with the image
- **v1.3.1 (build 19)** — Version bump for resubmission only
- **v1.3.0 (build 18)** — On-photo Length/Area measurement with calibration;
  "Pull from Photos" in QuoteScreen; per-customer revenue stats; expanded
  i18n; Sentry hook; `app.config.js` + EAS environment variables
- **v1.2.x** — Drawing tools (freehand / rectangle / circle / arrow), per-photo
  severity, in-place photo deletion

---

## Roadmap

Tracked in code and conversation; not exhaustive. Top items:

- Sprint C: first-run onboarding, error boundaries, data export/wipe, OTA updates
- Sprint D: rate book, quote templates, damage presets
- Sprint E: calibration carry-over across photos, polygon area, satellite-trace
  measurement
- Sprint F: cloud sync (Supabase), magic-link auth, multi-device, then RevenueCat
  for paid tiers
