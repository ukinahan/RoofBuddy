# RoofBuddy

A React Native (Expo) mobile app for iPhone and iPad that lets roof inspectors capture photos, automatically detect areas of concern using AI, annotate images, and generate professional PDF reports for customers.

---

## Features

- **Camera capture** — Full-screen camera with 3×3 grid overlay to help frame each roof section; take as many photos as needed per inspection
- **Photo library import** — Pick existing photos from your device's library
- **Tap-to-annotate** — Tap anywhere on a photo to drop a concern marker; choose High / Medium / Low severity and add a description
- **AI analysis** — Sends each photo to GPT-4o Vision, which returns a written summary and automatically places coloured pins on detected issues (cracked shingles, flashing damage, staining, etc.)
- **Inspector notes** — Free-text notes per photo and per inspection
- **PDF report generation** — Branded, printable PDF embedding all photos, annotations, AI summaries, and a severity summary card
- **Email to customer** — Pre-fills the native iOS/Android mail composer with the PDF attached and the customer's address populated
- **Share / Save** — Share the PDF via AirDrop, Messages, Files, or any other share-sheet option
- **Offline-first** — All data and photos are stored on-device with no account or login required; internet is only needed for AI analysis

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 52 |
| Language | TypeScript |
| Navigation | React Navigation v6 (native stack) |
| Storage | AsyncStorage (device-local, offline) |
| Camera | expo-camera |
| AI | OpenAI GPT-4o Vision API |
| PDF | expo-print |
| Email | expo-mail-composer |
| Sharing | expo-sharing |

---

## Project Structure

```
RoofBuddy/
├── App.tsx                          # Root navigator
├── app.json                         # Expo config (permissions, bundle IDs)
├── src/
│   ├── types/index.ts               # Shared TypeScript types
│   ├── services/
│   │   ├── ai.ts                    # GPT-4o Vision integration
│   │   ├── storage.ts               # AsyncStorage CRUD helpers
│   │   └── report.ts                # PDF builder + email/share
│   ├── screens/
│   │   ├── HomeScreen.tsx           # Inspection list
│   │   ├── NewInspectionScreen.tsx  # Create inspection form
│   │   ├── InspectionScreen.tsx     # Photo grid for an inspection
│   │   ├── CameraScreen.tsx         # Full-screen camera
│   │   ├── PhotoDetailScreen.tsx    # Annotate + AI analyse a photo
│   │   └── ReportScreen.tsx         # Preview + generate + send report
│   └── components/
│       ├── InspectionCard.tsx       # Home list item
│       ├── PhotoCard.tsx            # Photo grid thumbnail
│       └── AnnotationPin.tsx        # Coloured concern pin on image
└── setup.ps1                        # One-time setup helper (Windows)
```

---

## Getting Started

### Prerequisites

- [Node.js 20 LTS](https://nodejs.org/)
- [Expo Go](https://apps.apple.com/app/expo-go/id982107779) installed on your iPhone or iPad
- An [OpenAI API key](https://platform.openai.com/api-keys) (free tier works for testing)

### 1. Install dependencies

```powershell
cd RoofBuddy
npm install
```

Or run the guided setup script (Windows):

```powershell
.\setup.ps1
```

### 2. Add your OpenAI API key

Open `src/services/ai.ts` and replace the placeholder:

```ts
const OPENAI_API_KEY = 'sk-REPLACE_WITH_YOUR_OPENAI_API_KEY';
```

> Keep your key private — never commit it to a public repository.

### 3. Start the development server

```powershell
npm start
```

### 4. Open on your device

1. Make sure your phone and computer are on the **same Wi-Fi network**
2. Open the **Camera app** on iPhone/iPad and scan the QR code shown in the terminal
3. The app will open in Expo Go

---

## Building for the App Store

This app uses [Expo Application Services (EAS)](https://expo.dev/eas) for standalone builds.

```powershell
npm install -g eas-cli
eas login
eas build --platform ios
```

A free Expo account is required at [expo.dev](https://expo.dev).

---

## Usage Walkthrough

1. **Home screen** → tap **+ New Inspection**
2. Enter customer name, email, property address, and your name → **Create Inspection**
3. Tap **Camera** to take roof photos or **Library** to import existing ones
4. Tap any photo thumbnail to open it
5. **Tap anywhere on the photo** to drop a concern marker — select severity and describe the issue
6. Tap **Analyse with AI** to let GPT-4o Vision detect additional damage automatically
7. Add written notes in the Inspector Notes box
8. Go back and tap **Report** → **Generate PDF Report**
9. Tap **Email to Customer** or **Share / Save** to deliver the report

---

## Severity Levels

| Level | Colour | Meaning |
|-------|--------|---------|
| High | Red | Immediate repair required |
| Medium | Orange | Repair within 3–6 months |
| Low | Green | Monitor / cosmetic issue |
