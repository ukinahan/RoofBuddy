"""Generate professional Roof Report user guides (App + Portal) as branded PDFs.

Output:
  - C:\\Users\\kinahanultan\\OneDrive\\Apps\\Roof Reports\\App User Guide.pdf
  - C:\\Users\\kinahanultan\\OneDrive\\Apps\\Roof Reports\\Portal User Guide.pdf
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ---------------------------------------------------------------------------
# Brand
# ---------------------------------------------------------------------------
BRAND_DARK = colors.HexColor("#0D2A55")     # deep navy from logo wordmark
BRAND_BLUE = colors.HexColor("#1E9CE6")     # bright sky blue from logo
BRAND_GREEN = colors.HexColor("#2CA84A")    # green roof panel
BRAND_ORANGE = colors.HexColor("#F2A03D")   # orange roof panel
INK = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#6B7280")
RULE = colors.HexColor("#E5E7EB")
PANEL = colors.HexColor("#F3F7FB")
PANEL_BORDER = colors.HexColor("#D6E4F0")

LOGO_PATH = r"C:\Users\kinahanultan\RoofInspector\assets\icon.png"
OUT_DIR = r"C:\Users\kinahanultan\OneDrive\Apps\Roof Reports"

PAGE_W, PAGE_H = LETTER
MARGIN_L = 0.75 * inch
MARGIN_R = 0.75 * inch
MARGIN_T = 1.15 * inch
MARGIN_B = 0.85 * inch


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()["BodyText"]
    body_font = "Helvetica"
    bold_font = "Helvetica-Bold"

    s = {
        "CoverTitle": ParagraphStyle(
            "CoverTitle", parent=base, fontName=bold_font, fontSize=34,
            leading=40, alignment=TA_CENTER, textColor=BRAND_DARK, spaceAfter=8,
        ),
        "CoverSubtitle": ParagraphStyle(
            "CoverSubtitle", parent=base, fontName=body_font, fontSize=15,
            leading=20, alignment=TA_CENTER, textColor=BRAND_BLUE, spaceAfter=6,
        ),
        "CoverTagline": ParagraphStyle(
            "CoverTagline", parent=base, fontName=body_font, fontSize=11,
            leading=16, alignment=TA_CENTER, textColor=MUTED,
        ),
        "H1": ParagraphStyle(
            "H1", parent=base, fontName=bold_font, fontSize=18, leading=22,
            textColor=BRAND_DARK, spaceBefore=18, spaceAfter=10,
        ),
        "H2": ParagraphStyle(
            "H2", parent=base, fontName=bold_font, fontSize=12.5, leading=16,
            textColor=BRAND_DARK, spaceBefore=10, spaceAfter=4,
        ),
        "Body": ParagraphStyle(
            "Body", parent=base, fontName=body_font, fontSize=10.5, leading=15,
            textColor=INK, spaceAfter=6, alignment=TA_LEFT,
        ),
        "Bullet": ParagraphStyle(
            "Bullet", parent=base, fontName=body_font, fontSize=10.5, leading=15,
            textColor=INK, leftIndent=18, bulletIndent=6, spaceAfter=3,
        ),
        "Numbered": ParagraphStyle(
            "Numbered", parent=base, fontName=body_font, fontSize=10.5, leading=15,
            textColor=INK, leftIndent=22, bulletIndent=4, spaceAfter=4,
        ),
        "Tip": ParagraphStyle(
            "Tip", parent=base, fontName=body_font, fontSize=10, leading=14,
            textColor=BRAND_DARK, leftIndent=10, rightIndent=10, spaceAfter=4,
        ),
        "TOCEntry": ParagraphStyle(
            "TOCEntry", parent=base, fontName=body_font, fontSize=11, leading=18,
            textColor=INK,
        ),
        "TOCNum": ParagraphStyle(
            "TOCNum", parent=base, fontName=bold_font, fontSize=11, leading=18,
            textColor=BRAND_BLUE,
        ),
        "Footer": ParagraphStyle(
            "Footer", parent=base, fontName=body_font, fontSize=8.5, leading=11,
            textColor=MUTED,
        ),
        "TableHeader": ParagraphStyle(
            "TableHeader", parent=base, fontName=bold_font, fontSize=10,
            leading=13, textColor=colors.white,
        ),
        "TableCell": ParagraphStyle(
            "TableCell", parent=base, fontName=body_font, fontSize=10,
            leading=13, textColor=INK,
        ),
    }
    return s


STYLES = build_styles()


# ---------------------------------------------------------------------------
# Page chrome (header / footer)
# ---------------------------------------------------------------------------
@dataclass
class DocMeta:
    product: str
    title: str
    version: str
    audience: str


def draw_page_chrome(canvas, doc, meta: DocMeta) -> None:
    canvas.saveState()

    # Top accent bar
    canvas.setFillColor(BRAND_DARK)
    canvas.rect(0, PAGE_H - 0.35 * inch, PAGE_W, 0.35 * inch, fill=1, stroke=0)
    # Thin colored stripe under it (blue / green / orange)
    stripe_w = PAGE_W / 3
    canvas.setFillColor(BRAND_BLUE)
    canvas.rect(0, PAGE_H - 0.42 * inch, stripe_w, 0.07 * inch, fill=1, stroke=0)
    canvas.setFillColor(BRAND_GREEN)
    canvas.rect(stripe_w, PAGE_H - 0.42 * inch, stripe_w, 0.07 * inch, fill=1, stroke=0)
    canvas.setFillColor(BRAND_ORANGE)
    canvas.rect(stripe_w * 2, PAGE_H - 0.42 * inch, stripe_w, 0.07 * inch, fill=1, stroke=0)

    # Header text
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 11)
    canvas.drawString(MARGIN_L, PAGE_H - 0.23 * inch, meta.product)
    canvas.setFont("Helvetica", 10)
    canvas.drawRightString(PAGE_W - MARGIN_R, PAGE_H - 0.23 * inch, meta.title)

    # Footer rule
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_L, 0.6 * inch, PAGE_W - MARGIN_R, 0.6 * inch)

    # Footer text
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8.5)
    canvas.drawString(MARGIN_L, 0.42 * inch, f"{meta.product} · {meta.title} · {meta.version}")
    canvas.drawRightString(
        PAGE_W - MARGIN_R, 0.42 * inch, f"Page {doc.page}"
    )
    canvas.drawString(MARGIN_L, 0.28 * inch, "support@roofinspector.app")
    canvas.drawRightString(
        PAGE_W - MARGIN_R, 0.28 * inch, "© 2026 Roof Report"
    )

    canvas.restoreState()


def draw_cover_chrome(canvas, doc) -> None:
    """Cover page has its own decorative chrome (no top header bar)."""
    canvas.saveState()
    # Top accent bar (slim) + tri-color stripe under it
    canvas.setFillColor(BRAND_DARK)
    canvas.rect(0, PAGE_H - 0.55 * inch, PAGE_W, 0.55 * inch, fill=1, stroke=0)
    stripe_w = PAGE_W / 3
    canvas.setFillColor(BRAND_BLUE)
    canvas.rect(0, PAGE_H - 0.66 * inch, stripe_w, 0.11 * inch, fill=1, stroke=0)
    canvas.setFillColor(BRAND_GREEN)
    canvas.rect(stripe_w, PAGE_H - 0.66 * inch, stripe_w, 0.11 * inch, fill=1, stroke=0)
    canvas.setFillColor(BRAND_ORANGE)
    canvas.rect(stripe_w * 2, PAGE_H - 0.66 * inch, stripe_w, 0.11 * inch, fill=1, stroke=0)

    # Cover-page header text on the dark bar
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 11)
    canvas.drawString(MARGIN_L, PAGE_H - 0.36 * inch, "ROOF REPORT")
    canvas.setFont("Helvetica", 10)
    canvas.drawRightString(PAGE_W - MARGIN_R, PAGE_H - 0.36 * inch, "User Guide")

    # Bottom decorative stripe
    canvas.setFillColor(BRAND_BLUE)
    canvas.rect(0, 0.85 * inch, stripe_w, 0.08 * inch, fill=1, stroke=0)
    canvas.setFillColor(BRAND_GREEN)
    canvas.rect(stripe_w, 0.85 * inch, stripe_w, 0.08 * inch, fill=1, stroke=0)
    canvas.setFillColor(BRAND_ORANGE)
    canvas.rect(stripe_w * 2, 0.85 * inch, stripe_w, 0.08 * inch, fill=1, stroke=0)

    # Footer line
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 9)
    canvas.drawCentredString(PAGE_W / 2, 0.55 * inch,
                             "support@roofinspector.app   ·   admin.roofinspector.app")
    canvas.drawCentredString(PAGE_W / 2, 0.38 * inch,
                             "© 2026 Roof Report. All rights reserved.")
    canvas.restoreState()


# ---------------------------------------------------------------------------
# Reusable flowables
# ---------------------------------------------------------------------------
def hr(color=RULE, thickness=0.6, space_before=2, space_after=8):
    from reportlab.platypus import HRFlowable
    return HRFlowable(
        width="100%", thickness=thickness, color=color,
        spaceBefore=space_before, spaceAfter=space_after,
    )


def section_heading(num: str, title: str):
    """A numbered section heading with a colored block accent."""
    cell = Paragraph(
        f'<font color="#1E9CE6"><b>{num}</b></font>'
        f'&nbsp;&nbsp;<font color="#0D2A55"><b>{title}</b></font>',
        ParagraphStyle("SH", fontName="Helvetica-Bold", fontSize=15, leading=19),
    )
    tbl = Table([[cell]], colWidths=[PAGE_W - MARGIN_L - MARGIN_R])
    tbl.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (-1, -1), PANEL),
        ("LINEBEFORE", (0, 0), (0, -1), 4, BRAND_BLUE),
        ("LINEABOVE", (0, 0), (-1, 0), 0.4, PANEL_BORDER),
        ("LINEBELOW", (0, -1), (-1, -1), 0.4, PANEL_BORDER),
    ]))
    return KeepTogether([Spacer(1, 14), tbl, Spacer(1, 8)])


def body(text: str):
    return Paragraph(text, STYLES["Body"])


def bullets(items: Iterable[str]):
    out = []
    for it in items:
        out.append(Paragraph(it, STYLES["Bullet"], bulletText="•"))
    return out


def numbered(items: Iterable[str], start: int = 1):
    out = []
    for i, it in enumerate(items, start=start):
        out.append(Paragraph(it, STYLES["Numbered"], bulletText=f"{i}."))
    return out


def tip(text: str):
    cell = Paragraph(
        f'<font color="#0D2A55"><b>Tip&nbsp;&nbsp;</b></font>{text}',
        STYLES["Tip"],
    )
    tbl = Table([[cell]], colWidths=[PAGE_W - MARGIN_L - MARGIN_R])
    tbl.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF7E6")),
        ("LINEBEFORE", (0, 0), (0, -1), 3, BRAND_ORANGE),
    ]))
    return KeepTogether([Spacer(1, 4), tbl, Spacer(1, 8)])


def info(text: str):
    cell = Paragraph(text, STYLES["Tip"])
    tbl = Table([[cell]], colWidths=[PAGE_W - MARGIN_L - MARGIN_R])
    tbl.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("BACKGROUND", (0, 0), (-1, -1), PANEL),
        ("LINEBEFORE", (0, 0), (0, -1), 3, BRAND_BLUE),
    ]))
    return KeepTogether([Spacer(1, 4), tbl, Spacer(1, 8)])


def kv_table(rows: list[tuple[str, str]], col_widths=None):
    avail = PAGE_W - MARGIN_L - MARGIN_R
    if col_widths is None:
        col_widths = [avail * 0.36, avail * 0.64]
    data = [
        [Paragraph(f"<b>{h}</b>", STYLES["TableHeader"]),
         Paragraph(v, STYLES["TableCell"])]
        for h, v in rows
    ]
    # Insert header
    header = [
        Paragraph("<b>Problem</b>", STYLES["TableHeader"]),
        Paragraph("<b>Try this</b>", STYLES["TableHeader"]),
    ]
    data = [header] + [
        [Paragraph(h, STYLES["TableCell"]),
         Paragraph(v, STYLES["TableCell"])] for h, v in rows
    ]
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PANEL]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, BRAND_DARK),
        ("LINEBELOW", (0, 1), (-1, -2), 0.3, RULE),
        ("BOX", (0, 0), (-1, -1), 0.4, PANEL_BORDER),
    ]))
    return tbl


def toc(entries: list[tuple[str, str]]):
    """entries: list of (number, title)."""
    avail = PAGE_W - MARGIN_L - MARGIN_R
    rows = []
    for num, title in entries:
        rows.append([
            Paragraph(num, STYLES["TOCNum"]),
            Paragraph(title, STYLES["TOCEntry"]),
        ])
    tbl = Table(rows, colWidths=[0.5 * inch, avail - 0.5 * inch])
    tbl.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return tbl


# ---------------------------------------------------------------------------
# Document assembly
# ---------------------------------------------------------------------------
def build_doc(out_path: str, meta: DocMeta, body_flowables: list, cover_flowables: list) -> None:
    doc = BaseDocTemplate(
        out_path,
        pagesize=LETTER,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=MARGIN_T,
        bottomMargin=MARGIN_B,
        title=f"{meta.product} — {meta.title}",
        author="Roof Report",
        subject=meta.title,
    )

    cover_frame = Frame(
        MARGIN_L, MARGIN_B,
        PAGE_W - MARGIN_L - MARGIN_R,
        PAGE_H - MARGIN_B - 0.6 * inch,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id="cover",
    )
    body_frame = Frame(
        MARGIN_L, MARGIN_B,
        PAGE_W - MARGIN_L - MARGIN_R,
        PAGE_H - MARGIN_T - MARGIN_B,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id="body",
    )

    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[cover_frame], onPage=draw_cover_chrome),
        PageTemplate(id="Body", frames=[body_frame],
                     onPage=lambda c, d: draw_page_chrome(c, d, meta)),
    ])

    story = list(cover_flowables)
    story.append(PageBreak())
    # Switch template
    from reportlab.platypus.doctemplate import NextPageTemplate
    story.insert(len(cover_flowables), NextPageTemplate("Body"))
    story.extend(body_flowables)
    doc.build(story)


def cover(meta: DocMeta, tagline: str) -> list:
    logo_w = 3.2 * inch
    img = Image(LOGO_PATH, width=logo_w, height=logo_w)
    img.hAlign = "CENTER"

    flow = [
        Spacer(1, 0.6 * inch),
        img,
        Spacer(1, 0.4 * inch),
        # Thin colored divider
        Table(
            [[""]], colWidths=[1.6 * inch], rowHeights=[3],
            style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), BRAND_BLUE)]),
            hAlign="CENTER",
        ),
        Spacer(1, 0.35 * inch),
        Paragraph(meta.title.upper(), ParagraphStyle(
            "CoverTitleUC", fontName="Helvetica-Bold", fontSize=22,
            leading=28, alignment=TA_CENTER, textColor=BRAND_DARK,
            spaceBefore=0,
        )),
        Spacer(1, 0.18 * inch),
        Paragraph(tagline, ParagraphStyle(
            "CoverTag", fontName="Helvetica", fontSize=12,
            leading=18, alignment=TA_CENTER, textColor=MUTED,
            leftIndent=40, rightIndent=40,
        )),
        Spacer(1, 0.9 * inch),
        # Audience pill
        Table(
            [[Paragraph(meta.audience, ParagraphStyle(
                "CoverAud", fontName="Helvetica-Bold", fontSize=11,
                leading=14, alignment=TA_CENTER, textColor=colors.white,
            ))]],
            colWidths=[5.0 * inch],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), BRAND_DARK),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ]),
            hAlign="CENTER",
        ),
        Spacer(1, 0.18 * inch),
        Paragraph(meta.version, ParagraphStyle(
            "CoverVer", fontName="Helvetica", fontSize=10,
            leading=14, alignment=TA_CENTER, textColor=MUTED)),
    ]
    return flow


# ---------------------------------------------------------------------------
# Content: App User Guide
# ---------------------------------------------------------------------------
def app_guide_content() -> tuple[DocMeta, list, list]:
    meta = DocMeta(
        product="Roof Report",
        title="Mobile App User Guide",
        version="Version 1.0  ·  April 2026",
        audience="For Inspectors  ·  iPhone & iPad",
    )

    sections = [
        ("01", "Install & sign in"),
        ("02", "Set up your company profile"),
        ("03", "Add a customer"),
        ("04", "Start a new inspection"),
        ("05", "Capture photos"),
        ("06", "Measure the roof"),
        ("07", "Build the quote"),
        ("08", "Generate & share the PDF report"),
        ("09", "Sync with the office"),
        ("10", "Day-to-day tips"),
        ("11", "Troubleshooting"),
    ]

    flow: list = []
    flow.append(Paragraph("Welcome", STYLES["H1"]))
    flow.append(body(
        "<b>Roof Report</b> turns your iPhone into a complete roof-inspection toolkit. "
        "Capture photos in the field, measure roofs from satellite imagery, build a quote on the spot, "
        "and email a polished PDF to the customer before you leave the driveway."
    ))
    flow.append(body(
        "This guide walks you through everything an inspector needs — from your first sign-in "
        "to delivering a finished report."
    ))
    flow.append(Spacer(1, 6))
    flow.append(Paragraph("Contents", STYLES["H2"]))
    flow.append(toc(sections))

    # 1
    flow.append(section_heading("01", "Install & sign in"))
    flow.extend(numbered([
        "Install <b>Roof Report</b> from the App Store (or accept the TestFlight invite).",
        "Open the app and tap <b>Sign in</b>.",
        "Enter your work email address and tap <b>Send code</b>.",
        "Open the email from <font face='Courier'>noreply@roofinspector.app</font> and tap the magic link, "
        "<b>or</b> type the 6-digit code into the app.",
        "<b>First time only:</b> complete the onboarding screens (company name, logo, contact details, default rate book).",
    ]))
    flow.append(tip(
        "Use the <b>same email</b> you'll use for the admin web portal — one login covers both."
    ))

    # 2
    flow.append(section_heading("02", "Set up your company profile"))
    flow.append(body("A one-time setup so every report carries your branding."))
    flow.extend(numbered([
        "From the home screen, tap the <b>gear icon</b> (Settings).",
        "Open <b>Company profile</b> and fill in:",
    ]))
    flow.extend(bullets([
        "Company name, phone, email, website",
        "Logo (tap to upload)",
        "License number (shown on PDFs)",
    ]))
    flow.extend(numbered([
        "Open <b>Rate book</b> and review the default line items and prices. Edit any values that don't match your pricing.",
        "Tap <b>Save</b>.",
    ], start=3))

    # 3
    flow.append(section_heading("03", "Add a customer"))
    flow.extend(numbered([
        "From the home screen, tap <b>Customers</b>.",
        "Tap <b>+ New customer</b> (top-right).",
        "Enter name, phone, email, and property address. The address is used for maps, directions, and the report header.",
        "Tap <b>Save</b>.",
    ]))
    flow.append(info(
        "You can also bulk-import customers from a CSV via <b>Settings → Bulk import</b>."
    ))

    # 4
    flow.append(section_heading("04", "Start a new inspection"))
    flow.extend(numbered([
        "From the home screen, tap <b>+ New inspection</b>.",
        "Pick the customer (or tap <b>+ New customer</b> to add one on the fly).",
        "Confirm the property address and tap <b>Start inspection</b>.",
    ]))

    # 5
    flow.append(section_heading("05", "Capture photos"))
    flow.extend(numbered([
        "On the inspection screen, tap the <b>camera button</b>.",
        "Take photos of each area of concern. The camera auto-saves each shot to the inspection.",
        "After each photo, you can:",
    ]))
    flow.extend(bullets([
        "<b>Annotate</b> — draw arrows or circles on the photo",
        "<b>Add a note</b> — short caption shown under the photo on the report",
        "<b>Set severity</b> — Low / Medium / High (drives the summary on the report)",
        "<b>Tag damage type</b> — choose from presets (e.g. <i>missing shingle</i>, <i>cracked flashing</i>)",
    ]))
    flow.extend(numbered([
        "Tap <b>Done</b> to return to the inspection.",
    ], start=4))
    flow.append(tip("Hold the phone in <b>landscape</b> for wider roof shots."))

    # 6
    flow.append(section_heading("06", "Measure the roof"))
    flow.append(body("<i>Optional — useful when a quote depends on roof area.</i>"))
    flow.extend(numbered([
        "On the inspection screen, tap <b>Roof measure</b>.",
        "Search for the property address — the satellite view will load.",
        "Tap to drop points around the roof outline; tap <b>Close shape</b> to finish.",
        "Enter the <b>pitch</b> (or use the <b>Pitch detector</b> to estimate from a photo).",
        "Tap <b>Save</b> — the area, perimeter and pitch are added to the inspection.",
    ]))

    # 7
    flow.append(section_heading("07", "Build the quote"))
    flow.extend(numbered([
        "On the inspection screen, scroll to <b>Quote</b> and tap <b>Edit</b>.",
        "Tap <b>+ Add line item</b> and pick from your rate book, or type a custom description.",
        "Adjust quantity and unit price as needed. Totals (subtotal, tax, total) update automatically.",
        "Tap <b>Save</b>.",
    ]))

    # 8
    flow.append(section_heading("08", "Generate & share the PDF report"))
    flow.extend(numbered([
        "On the inspection screen, tap <b>Report</b> (top-right).",
        "Preview the report — scroll through to confirm photos, notes and quote look right.",
        "Tap <b>Share</b> and pick:",
    ]))
    flow.extend(bullets([
        "<b>Email</b> — opens Mail with the PDF attached",
        "<b>Save to Files</b> — keep a local copy",
        "<b>Print</b> — send to any AirPrint printer",
    ]))
    flow.extend(numbered([
        "To finalise, tap <b>Mark complete</b> on the inspection screen.",
    ], start=4))

    # 9
    flow.append(section_heading("09", "Sync with the office"))
    flow.extend(bullets([
        "The app <b>auto-syncs</b> photos and inspection data to the cloud whenever you have signal "
        "(on launch, on foreground, and after each save).",
        "A <b>green check</b> on the inspection card means it has synced.",
        "An <b>orange cloud icon</b> means it's pending — connect to Wi-Fi and reopen the app to push it.",
    ]))

    # 10
    flow.append(section_heading("10", "Day-to-day tips"))
    flow.extend(bullets([
        "<b>Jobs tab</b> shows today's scheduled inspections.",
        "<b>Pull down</b> on any list to refresh from the cloud.",
        "<b>Long-press</b> a photo to delete or reorder.",
        "<b>Settings → Backup</b> lets you export everything as a single JSON file.",
        "If something looks off, <b>Settings → Send diagnostics</b> ships logs to support.",
    ]))

    # 11
    trouble = [
        section_heading("11", "Troubleshooting"),
        kv_table([
            ("Magic-link email never arrives",
             "Check spam; tap <b>Resend code</b> after 60 seconds."),
            ("Photos won't upload",
             "Settings → toggle <b>Sync</b> off and on; check Wi-Fi."),
            ("Map won't load on Roof measure",
             "Settings → confirm location permission is set to <b>Allow</b>."),
            ("Report PDF looks blank",
             "Force-quit the app and reopen; retry <b>Report</b>."),
            ("Wrong company logo",
             "Settings → Company profile → tap logo → re-upload."),
        ]),
        Spacer(1, 14),
        info(
            "Need a hand? Email <b>support@roofinspector.app</b> and we'll get back to you "
            "the same business day."
        ),
    ]
    flow.append(KeepTogether(trouble))

    return meta, flow, cover(meta, "Inspect roofs. Capture photos. Send polished reports — all from your iPhone.")


# ---------------------------------------------------------------------------
# Content: Portal User Guide
# ---------------------------------------------------------------------------
def portal_guide_content() -> tuple[DocMeta, list, list]:
    meta = DocMeta(
        product="Roof Report",
        title="Admin Web Portal User Guide",
        version="Version 1.0  ·  April 2026",
        audience="For Office Admins  ·  admin.roofinspector.app",
    )

    sections = [
        ("01", "What the portal is for"),
        ("02", "Sign in for the first time"),
        ("03", "How an inspector grants you access"),
        ("04", "The dashboard"),
        ("05", "Open and review an inspection"),
        ("06", "Edit an inspection"),
        ("07", "Generate the PDF report"),
        ("08", "Email the report to the customer"),
        ("09", "Customers tab"),
        ("10", "Sharing tab (account owners only)"),
        ("11", "Settings"),
        ("12", "Troubleshooting"),
        ("13", "Security & privacy"),
        ("14", "Quick reference"),
    ]

    flow: list = []
    flow.append(Paragraph("Welcome", STYLES["H1"]))
    flow.append(body(
        "The <b>Roof Report Admin Portal</b> is the desktop companion to the mobile app. "
        "Inspectors capture photos and notes in the field; you use the portal to review them, "
        "fix typos, adjust quotes, generate the PDF, and email it to the customer."
    ))
    flow.append(body(
        "Nothing to install — it runs in any modern browser (Chrome, Edge, Safari, Firefox)."
    ))
    flow.append(Spacer(1, 6))
    flow.append(Paragraph("Contents", STYLES["H2"]))
    flow.append(toc(sections))

    # 1
    flow.append(section_heading("01", "What the portal is for"))
    flow.append(body(
        "The web portal is the desktop companion to the Roof Report iPhone app. "
        "Inspectors capture photos and notes in the field; you use the portal to review them, "
        "fix typos, adjust quotes, generate the PDF, and email it to the customer."
    ))
    flow.append(info(
        "You do <b>not</b> need to install anything — it runs in any modern browser "
        "(Chrome, Edge, Safari, Firefox)."
    ))

    # 2
    flow.append(section_heading("02", "Sign in for the first time"))
    flow.extend(numbered([
        "Open <b>https://admin.roofinspector.app</b> in your browser.",
        "Enter your work email address and click <b>Send sign-in link</b>.",
        "Open the email from <font face='Courier'>noreply@roofinspector.app</font>.",
        "Click <b>Sign in to Roof Report</b> — you'll be returned to the portal, already signed in.",
    ]))
    flow.append(tip(
        "Your sign-in stays active for ~30 days. Use the same email the inspector invited "
        "(or your own if you're the account owner)."
    ))

    # 3
    flow.append(section_heading("03", "How an inspector grants you access"))
    flow.append(body("If you're an assistant (not the account owner), the inspector adds you on the phone:"))
    flow.extend(numbered([
        "On the iPhone app, the inspector taps <b>Settings → Sharing → Invite</b>.",
        "They type your email and tap <b>Send invite</b>.",
        "You receive the magic-link email (step 2 above) and sign in.",
        "You'll now see <b>all</b> of the inspector's customers and inspections.",
    ]))

    # 4
    flow.append(section_heading("04", "The dashboard"))
    flow.append(body("After sign-in you land on the <b>Inspections</b> list:"))
    flow.extend(bullets([
        "<b>Search bar</b> — search by customer name or address.",
        "<b>Filters</b> — status (Draft / Complete), severity, date range.",
        "<b>Sort</b> — newest first by default.",
        "Click any row to open the inspection.",
    ]))
    flow.append(body("The left-hand nav has:"))
    flow.extend(bullets([
        "<b>Inspections</b> — all jobs",
        "<b>Customers</b> — customer database",
        "<b>Sharing</b> — manage assistants (owners only)",
        "<b>Settings</b> — company profile, rate book, sign-out",
    ]))

    # 5
    flow.append(section_heading("05", "Open and review an inspection"))
    flow.extend(numbered([
        "From the dashboard, click the inspection row.",
        "The inspection page shows:",
    ]))
    flow.extend(bullets([
        "<b>Header</b> — customer, address, date, severity, status",
        "<b>Photos</b> — full grid with annotations and notes",
        "<b>Measurements</b> — area, perimeter, pitch (if captured)",
        "<b>Quote</b> — line items, subtotal, tax, total",
        "<b>Notes</b> — inspector's free-text notes",
    ]))
    flow.extend(numbered([
        "Click any photo to open it full-screen with its annotation overlay.",
    ], start=3))

    # 6
    flow.append(section_heading("06", "Edit an inspection"))
    flow.extend(numbered([
        "On the inspection page, click <b>Edit</b> (top-right).",
        "You can change:",
    ]))
    flow.extend(bullets([
        "Customer name and address",
        "Severity (Low / Medium / High)",
        "Inspector notes (typos, clarifications)",
        "<b>Office note</b> — admin-only note that appears on the report",
        "Quote line items (add, remove, edit description / qty / price)",
    ]))
    flow.extend(numbered([
        "Click <b>Save</b>.",
        "Changes sync back to the inspector's phone the next time they open the app.",
    ], start=3))
    flow.append(info(
        "You <b>cannot</b> add new photos from the portal — that stays mobile-only so photos "
        "always carry GPS / camera metadata."
    ))

    # 7
    flow.append(section_heading("07", "Generate the PDF report"))
    flow.extend(numbered([
        "On the inspection page, click <b>Report → Download PDF</b>.",
        "The portal renders the same PDF the mobile app generates.",
        "The file downloads to your computer as <font face='Courier'>Inspection-&lt;customer&gt;-&lt;date&gt;.pdf</font>.",
        "Open it to review before sending.",
    ]))

    # 8
    flow.append(section_heading("08", "Email the report to the customer"))
    flow.extend(numbered([
        "On the inspection page, click <b>Report → Email</b>.",
        "The form pre-fills:",
    ]))
    flow.extend(bullets([
        "<b>To</b> — the customer's email (from their record)",
        "<b>CC</b> — your own email",
        "<b>Subject</b> — &ldquo;Your roof inspection report — &lt;address&gt;&rdquo;",
        "<b>Body</b> — a templated message (editable)",
    ]))
    flow.extend(numbered([
        "Edit recipients, subject, or body as needed.",
        "Click <b>Send</b>. You'll see a green confirmation when it's delivered.",
        "The send is logged on the inspection page (date and recipients).",
    ], start=3))

    # 9
    flow.append(section_heading("09", "Customers tab"))
    flow.extend(numbered([
        "Click <b>Customers</b> in the left nav.",
        "Use search to find a customer.",
        "Click a row to open and edit name, phone, email, address.",
        "<b>+ New customer</b> (top-right) to add one manually.",
        "<b>Merge</b> — select two duplicate customers (checkboxes) and click <b>Merge</b> "
        "to combine their inspections under one record.",
    ]))

    # 10
    flow.append(section_heading("10", "Sharing tab (account owners only)"))
    flow.extend(numbered([
        "Click <b>Sharing</b> in the left nav.",
        "<b>+ Invite assistant</b> — enter their email and click <b>Send invite</b>.",
        "They appear in the list as <b>Pending</b> until they sign in.",
        "Click <b>Revoke</b> next to a name to remove their access immediately.",
    ]))

    # 11
    flow.append(section_heading("11", "Settings"))
    flow.extend(bullets([
        "<b>Company profile</b> — name, logo, license, contact info shown on PDFs.",
        "<b>Rate book</b> — default line items and prices for new quotes.",
        "<b>Email template</b> — edit the default body used when emailing reports.",
        "<b>Sign out</b> — ends your session.",
    ]))

    # 12
    flow.append(KeepTogether([
        section_heading("12", "Troubleshooting"),
        kv_table([
            ("Sign-in link never arrives",
             "Check spam; click <b>Resend</b> after 60 seconds."),
            ("New inspection from inspector not showing",
             "Click the <b>refresh</b> icon; the phone syncs on launch and foreground."),
            ("PDF download fails",
             "Try a different browser; disable popup blocker."),
            ("Email send fails",
             "Check the customer email is valid; retry; check the <b>Sent</b> log."),
            ("&ldquo;Permission denied&rdquo; on a record",
             "Ask the account owner to re-invite you in <b>Sharing</b>."),
            ("Photo thumbnails are missing",
             "They're still uploading from the phone — refresh in a few minutes."),
        ]),
    ]))

    # 13
    flow.append(section_heading("13", "Security & privacy"))
    flow.extend(bullets([
        "All traffic is HTTPS.",
        "Data is stored in the same Supabase backend as the mobile app, scoped to your "
        "account by row-level security.",
        "Magic-link sign-in means there's no password to leak.",
        "Photos are served via short-lived signed URLs.",
        "An assistant only sees the data of the inspector who invited them.",
    ]))

    # 14
    flow.append(section_heading("14", "Quick reference"))
    flow.append(kv_table_quickref([
        ("Portal URL", "<b>https://admin.roofinspector.app</b>"),
        ("Sign-in", "Magic link to your work email (no password)."),
        ("Cannot do on web", "Capture or annotate new photos."),
        ("Can do on web", "Review, edit notes &amp; quotes, generate PDF, email customer, "
                          "manage customers, invite assistants."),
        ("Support", "<b>support@roofinspector.app</b>"),
    ]))

    return meta, flow, cover(
        meta,
        "Review inspections, polish the details, and email reports to customers from your desk."
    )


def kv_table_quickref(rows: list[tuple[str, str]]):
    """Two-column reference table with branded header."""
    avail = PAGE_W - MARGIN_L - MARGIN_R
    data = [[
        Paragraph("<b>Item</b>", STYLES["TableHeader"]),
        Paragraph("<b>Detail</b>", STYLES["TableHeader"]),
    ]]
    for k, v in rows:
        data.append([
            Paragraph(k, STYLES["TableCell"]),
            Paragraph(v, STYLES["TableCell"]),
        ])
    tbl = Table(data, colWidths=[avail * 0.30, avail * 0.70], repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PANEL]),
        ("LINEBELOW", (0, 1), (-1, -2), 0.3, RULE),
        ("BOX", (0, 0), (-1, -1), 0.4, PANEL_BORDER),
    ]))
    return tbl


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    meta_a, body_a, cover_a = app_guide_content()
    out_a = os.path.join(OUT_DIR, "App User Guide.pdf")
    build_doc(out_a, meta_a, body_a, cover_a)
    print(f"Wrote {out_a}")

    meta_p, body_p, cover_p = portal_guide_content()
    out_p = os.path.join(OUT_DIR, "Portal User Guide.pdf")
    build_doc(out_p, meta_p, body_p, cover_p)
    print(f"Wrote {out_p}")


if __name__ == "__main__":
    main()
