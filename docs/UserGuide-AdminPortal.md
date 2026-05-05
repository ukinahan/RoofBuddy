# Roof Report — Admin Web Portal User Guide

A simple step-by-step guide for office admins using
**admin.roofinspector.app** to review, edit, print and email inspection
reports.

---

## 1. What the portal is for

The web portal is the desktop companion to the Roof Report iPhone app.
Inspectors capture photos and notes in the field; you use the portal to
review them, fix typos, adjust quotes, generate the PDF, and email it to the
customer.

You do **not** need to install anything — it runs in any modern browser
(Chrome, Edge, Safari, Firefox).

---

## 2. Sign in for the first time

1. Open **https://admin.roofinspector.app** in your browser.
2. Enter your work email address and click **Send sign-in link**.
3. Open the email from `noreply@roofinspector.app`.
4. Click **Sign in to Roof Report** — you'll be returned to the portal,
   already signed in.

> Your sign-in stays active for ~30 days. Use the same email the inspector
> invited (or your own if you're the account owner).

---

## 3. How an inspector grants you access

If you're an assistant (not the account owner), the inspector adds you on
the phone:

1. On the iPhone app, the inspector taps **Settings → Sharing → Invite**.
2. They type your email and tap **Send invite**.
3. You receive the magic-link email (step 2 above) and sign in.
4. You'll now see **all** of the inspector's customers and inspections.

---

## 4. The dashboard

After sign-in you land on the **Inspections** list:

- **Search bar** — search by customer name or address.
- **Filters** — status (Draft / Complete), severity, date range.
- **Sort** — newest first by default.
- Click any row to open the inspection.

The left-hand nav has:

- **Inspections** — all jobs
- **Customers** — customer database
- **Sharing** — manage assistants (owners only)
- **Settings** — company profile, rate book, sign-out

---

## 5. Open and review an inspection

1. From the dashboard, click the inspection row.
2. The inspection page shows:
   - **Header** — customer, address, date, severity, status
   - **Photos** — full grid with annotations and notes
   - **Measurements** — area, perimeter, pitch (if captured)
   - **Quote** — line items, subtotal, tax, total
   - **Notes** — inspector's free-text notes
3. Click any photo to open it full-screen with its annotation overlay.

---

## 6. Edit an inspection

1. On the inspection page, click **Edit** (top-right).
2. You can change:
   - Customer name / address
   - Severity (Low / Medium / High)
   - Inspector notes (typos, clarifications)
   - **Office note** — admin-only note that appears on the report
   - Quote line items (add, remove, edit description / qty / price)
3. Click **Save**.
4. Changes sync back to the inspector's phone the next time they open the
   app.

> You **cannot** add new photos from the portal — that stays mobile-only so
> photos always carry GPS / camera metadata.

---

## 7. Generate the PDF report

1. On the inspection page, click **Report → Download PDF**.
2. The portal renders the same branded PDF the mobile app generates: a navy
   cover page with your company logo and customer details, an overview
   table, the photos in a continuous flow (multiple per page where they
   fit), and the conclusion + cost of repairs immediately after the last
   photo.
3. The file downloads to your computer as
   `Inspection-<customer>-<date>.pdf`.
4. Open it to review before sending.

> Behind the scenes the portal uses a headless Chromium
> (`@sparticuz/chromium-min` + `puppeteer-core`) so the PDF is byte-for-byte
> the same layout the mobile app produces.

---

## 8. Email the report to the customer

1. On the inspection page, click **Report → Email**.
2. The form pre-fills:
   - **To** — the customer's email (from their record)
   - **CC** — your own email
   - **Subject** — "Your roof inspection report — <address>"
   - **Body** — a templated message (editable)
3. Edit recipients / subject / body as needed.
4. Click **Send**. You'll see a green confirmation when it's delivered.
5. The send is logged on the inspection page (date + recipients).

---

## 9. Customers tab

1. Click **Customers** in the left nav.
2. Use search to find a customer.
3. Click a row to open and edit name, phone, email, address.
4. **+ New customer** (top-right) to add one manually.
5. **Merge** — select two duplicate customers (checkboxes) and click
   **Merge** to combine their inspections under one record.

---

## 10. Sharing tab (account owners only)

1. Click **Sharing** in the left nav.
2. **+ Invite assistant** — enter their email and click **Send invite**.
3. They appear in the list as **Pending** until they sign in.
4. Click **Revoke** next to a name to remove their access immediately.

---

## 11. Settings

- **Company profile** — name, logo, license, contact info shown on PDFs.
  The logo is stored against your account in the database, so it appears on
  every report regardless of which device the inspection was created on.
  It renders centred on the cover page above the customer details box, and
  the company name + website / address + phone are split into two columns
  along the bottom of the cover.
- **Rate book** — default line items / prices for new quotes.
- **Email template** — edit the default body used when emailing reports.
- **Sign out** — ends your session.

---

## 12. Troubleshooting

| Problem | Try this |
|---|---|
| Sign-in link never arrives | Check spam; click **Resend** after 60s |
| New inspection from inspector not showing | Click the **refresh** icon; the phone syncs on launch / foreground |
| PDF download fails | Try a different browser; disable popup blocker |
| Email send fails | Check the customer email is valid; retry; check **Sent** log |
| "Permission denied" on a record | Ask the account owner to re-invite you in **Sharing** |
| Photo thumbnails are missing | They're still uploading from the phone — refresh in a few minutes |

---

## 13. Security & privacy

- All traffic is HTTPS.
- Data is stored in the same Supabase backend as the mobile app, scoped to
  your account by row-level security.
- Magic-link sign-in means there's no password to leak.
- Photos are served via short-lived signed URLs.
- An assistant only sees the data of the inspector who invited them.

---

## 14. Quick reference

- Portal: **https://admin.roofinspector.app**
- Sign-in: magic link to your work email (no password)
- Cannot do on web: capture / annotate new photos
- Can do on web: review, edit notes & quotes, generate PDF, email customer,
  manage customers, invite assistants

Support: **support@roofinspector.app**
