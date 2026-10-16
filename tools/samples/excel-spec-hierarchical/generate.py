#!/usr/bin/env python3
"""Generate a hierarchical Excel spec and the PDFs built from it.

    python tools/samples/excel-spec-hierarchical/generate.py

Writes, beside this script:
  report-spec.xlsx                the spec: a Pages List sheet, then one sheet per PDF page
  report.pdf                      a 4-page landscape report that matches the spec
  report-with-deviations.pdf      the same report with the deviations in DEVIATIONS
  assets/*.png                    the images the spec names by file name

The spec sheets use a nested layout: Element > Sub-element > Item, then a Parameter
group (Alignment, Size, Color, Text, Image, Graph, Table) and a Parameter, with the
value written as prose in Description (".75 inches from left of page").

Everything comes from PAGES below, so the workbook and the PDFs cannot drift. Output
is deterministic. Needs: openpyxl, reportlab, pillow, matplotlib. All content is fictional.
"""
from __future__ import annotations

import copy
import datetime as dt
import io
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from openpyxl import Workbook  # noqa: E402
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
from reportlab.lib.colors import HexColor  # noqa: E402
from reportlab.lib.utils import ImageReader, simpleSplit  # noqa: E402
from reportlab.pdfbase.pdfmetrics import stringWidth  # noqa: E402
from reportlab.pdfgen import canvas  # noqa: E402

HERE = Path(__file__).resolve().parent
W_IN, H_IN = 11.0, 8.5  # landscape letter
PT = 72.0
FIXED_TIME = dt.datetime(2026, 10, 16, 0, 0, 0)

NAVY = ("#0B3C5D", "Kestrel Navy")
CLOUD = ("#EEF1F4", "Cloud Grey")
SLATE = ("#52514E", "Slate")
WHITE = ("#FFFFFF", "White")
SERIES = [("#2A78D6", "Route Blue"), ("#EB6834", "Signal Orange")]
GRID = "#E5E7EB"


def pdf_font(name: str, bold: bool = False, italic: bool = False) -> str:
    base = {"Helvetica": "Helvetica", "Times": "Times"}[name]
    if base == "Times":
        return {(0, 0): "Times-Roman", (1, 0): "Times-Bold", (0, 1): "Times-Italic", (1, 1): "Times-BoldItalic"}[(bold, italic)]
    return {(0, 0): "Helvetica", (1, 0): "Helvetica-Bold", (0, 1): "Helvetica-Oblique", (1, 1): "Helvetica-BoldOblique"}[(bold, italic)]


# ─────────────────────────────────────────────────────────────────────────────
# The spec. Positions in inches from the page's top-left. A text's Vertical is the top
# of its line (baseline minus font size).
# ─────────────────────────────────────────────────────────────────────────────

def page_number(n: int) -> dict:
    return {"path": ("Footer", "Page number", ""), "kind": "text", "text": f"Page {n} of 4",
            "font": "Helvetica", "size": 8, "color": SLATE, "bottom": 0.40, "right": 0.50}


SUMMARY_TEXT = (
    "Deliveries rose for the third quarter in a row while fuel use fell, helped by the two "
    "electric vans added at the South depot in August. On-time performance improved in every "
    "region except Central, where road works on the ring road added an average of nine minutes "
    "to afternoon routes. Next quarter the focus moves to load planning at the East depot."
)
COMMENTARY_TEXT = (
    "The East region again completed the most deliveries, and the West region recovered from a slow "
    "second quarter. Central is the only region where the on-time rate fell; the delay is concentrated "
    "between 2 pm and 5 pm and is expected to ease when the road works finish in November."
)
FUEL_TEXT = (
    "Fuel use per 100 km fell from 31.4 litres in January to 27.9 litres in September. Most of the "
    "improvement came after route re-planning in April and the electric vans in August, which now "
    "cover the shortest urban routes."
)

KPI_COLUMNS = [("Measure", 2.8, "left"), ("This quarter", 1.4, "right"), ("Last quarter", 1.4, "right"), ("Change", 1.4, "right")]
KPI_ROWS = [
    ["Vehicles in service", "48", "46", "+2"],
    ["Deliveries completed", "18,420", "17,105", "+7.7%"],
    ["On-time rate", "94.2%", "91.8%", "+2.4 pts"],
    ["Distance driven (km)", "612,300", "598,950", "+2.2%"],
    ["Fuel used (litres)", "171,450", "176,320", "-2.8%"],
]
REGIONS = ["North", "South", "East", "West", "Central"]
DELIV_THIS = [3420, 3680, 4960, 3510, 2850]
DELIV_LAST = [3290, 3410, 4720, 3010, 2675]
REGION_COLUMNS = [("Region", 1.05, "left"), ("Deliveries", 0.85, "right"), ("On-time", 0.75, "right"), ("Avg delay", 0.85, "right")]
REGION_ROWS = [
    ["North", "3,420", "95.1%", "4 min"],
    ["South", "3,680", "96.0%", "3 min"],
    ["East", "4,960", "95.4%", "4 min"],
    ["West", "3,510", "94.8%", "5 min"],
    ["Central", "2,850", "88.9%", "13 min"],
    ["All regions", "18,420", "94.2%", "5 min"],
]
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]
FUEL = [31.4, 31.1, 30.8, 29.9, 29.5, 29.2, 28.9, 28.3, 27.9]
FUEL_COLUMNS = [("Month", 1.2, "left"), ("Litres / 100 km", 1.7, "right")]
FUEL_ROWS = [[f"{m} 2026", f"{v:.1f}"] for m, v in zip(MONTHS, FUEL)]

PAGES = [
    {
        "tab": "1", "name": "Cover", "type": "Required", "comments": "",
        "note": None,
        "elements": [
            {"path": ("Cover artwork", "Cover image", ""), "kind": "image", "file": "cover-artwork.png",
             "left": 0, "top": 0, "width": 11.0, "height": 4.25},
            {"path": ("Title block", "Container", ""), "kind": "container", "left": 0.75, "top": 4.75,
             "width": 9.5, "height": 2.25, "fill": CLOUD},
            {"path": ("Title block", "Contents", "Company logo"), "kind": "image", "file": "company-logo.png",
             "left": 1.0, "top": 5.0, "width": 1.75, "height": 0.5},
            {"path": ("Title block", "Contents", "Report title"), "kind": "text", "text": "Fleet Operations Review",
             "font": "Helvetica", "bold": True, "size": 28, "color": NAVY, "case": "Title", "left": 1.0, "top": 5.75,
             "extra": [("Wording for a single-depot report", 'Depot Operations Review\n\nNOTE: IF the report covers one depot only, use the wording "Depot Operations Review"')]},
            {"path": ("Title block", "Contents", "Reporting period"), "kind": "text", "text": "Quarter 3 2026",
             "dynamic": 'Rules: show as "Quarter n YYYY", for example "Quarter 3 2026"',
             "font": "Helvetica", "size": 14, "color": SLATE, "italic_word": "Quarter", "case": "Title", "left": 1.0, "top": 6.35},
            {"path": ("Title block", "Contents", "Prepared for"), "kind": "text", "text": "Prepared for: Bluefin Grocers",
             "dynamic": 'Rules: "Prepared for: " followed by the customer name from the account record',
             "font": "Helvetica", "size": 11, "color": SLATE, "left": 1.0, "top": 6.65},
            {"path": ("Footer", "Disclaimer", ""), "kind": "paragraph",
             "text": "For internal planning use. Figures are unaudited and may be restated in a later report.",
             "font": "Times", "size": 8, "color": SLATE, "left": 0.75, "top": 7.85, "wrap_at": 10.25, "spacing_pt": 10},
        ],
    },
    {
        "tab": "2", "name": "Fleet highlights", "type": "Required", "comments": "",
        "note": "The figures in the highlights table must match the regional table on page 3 and the fuel table on page 4.",
        "elements": [
            {"path": ("Left sidebar", "Container", ""), "kind": "container", "left": 0, "top": 0, "width": 2.75,
             "height": 8.5, "fill": NAVY},
            {"path": ("Left sidebar", "Contents", "Page title"), "kind": "text", "text": "Fleet Highlights",
             "lines": ["Fleet", "Highlights"], "line_break": 'Line break after "Fleet", 26 pt baseline to baseline',
             "font": "Helvetica", "bold": True, "size": 20, "color": WHITE, "case": "Title", "left": 0.4, "top": 0.75,
             "spacing_pt": 26},
            {"path": ("Left sidebar", "Contents", "Sidebar note"), "kind": "paragraph",
             "text": "All figures are for the quarter ending 30 September 2026.",
             "font": "Helvetica", "size": 9, "color": WHITE, "left": 0.4, "top": 7.2, "wrap_at": 2.45, "spacing_pt": 12},
            {"path": ("Main content", "Highlights table", ""), "kind": "table", "left": 3.25, "top": 0.75,
             "columns": KPI_COLUMNS, "rows": KPI_ROWS, "row_pitch": 0.35, "size": 11, "header_fill": NAVY},
            {"path": ("Main content", "Summary", "Heading"), "kind": "text", "text": "Quarter in Brief",
             "font": "Helvetica", "bold": True, "size": 14, "color": NAVY, "case": "Title", "left": 3.25, "top": 3.15},
            {"path": ("Main content", "Summary", "Paragraph"), "kind": "paragraph", "text": SUMMARY_TEXT,
             "font": "Times", "size": 11, "color": ("#111111", "Ink"), "left": 3.25, "top": 3.5, "wrap_at": 10.25,
             "spacing_pt": 15},
            {"path": ("Main content", "Depot map", "Image"), "kind": "image", "file": "depot-map.png",
             "left": 3.25, "top": 5.0, "width": 3.4, "height": 2.4},
            {"path": ("Main content", "Depot map", "Caption"), "kind": "text", "text": "Depot coverage, Q3 2026",
             "font": "Helvetica", "size": 9, "color": SLATE, "left": 3.25, "top": 7.55},
            page_number(2),
        ],
    },
    {
        "tab": "3", "name": "Delivery performance", "type": "Optional", "comments": "Optional page",
        "note": None,
        "elements": [
            {"path": ("Page header", "Title", ""), "kind": "text", "text": "Delivery Performance by Region",
             "font": "Helvetica", "bold": True, "size": 20, "color": NAVY, "case": "Title", "left": 0.75, "top": 0.6},
            {"path": ("Page header", "Rule", ""), "kind": "rule", "left": 0.75, "top": 1.1, "width": 9.5,
             "weight_pt": 1, "color": NAVY},
            {"path": ("Deliveries chart", "Graph", ""), "kind": "bar_chart", "left": 0.75, "top": 1.4,
             "width": 5.6, "height": 3.6, "title": "Deliveries by region",
             "categories": REGIONS, "series": [("This quarter", DELIV_THIS, SERIES[0]), ("Last quarter", DELIV_LAST, SERIES[1])],
             "y_max": 6000, "y_step": 1000, "y_title": "Deliveries"},
            {"path": ("Regional table", "Table", ""), "kind": "table", "left": 6.75, "top": 1.4,
             "columns": REGION_COLUMNS, "rows": REGION_ROWS, "row_pitch": 0.32, "size": 9.5, "header_fill": NAVY,
             "bold_last": True},
            {"path": ("Commentary", "Paragraph", ""), "kind": "paragraph", "text": COMMENTARY_TEXT,
             "font": "Times", "size": 11, "color": ("#111111", "Ink"), "left": 0.75, "top": 5.45, "wrap_at": 10.25,
             "spacing_pt": 15},
            {"path": ("Commentary", "Footnote", ""), "kind": "text",
             "text": "On-time means delivered within the booked one-hour window.",
             "font": "Helvetica", "italic": True, "size": 8, "color": SLATE, "left": 0.75, "top": 7.4},
            page_number(3),
        ],
    },
    {
        "tab": "4", "name": "Fuel efficiency trend", "type": "Conditional",
        "comments": "Conditional page - mandatory when three or more months of fuel data are available",
        "note": "Show this page only when the period has three or more months of fuel data. When shown, the September value must equal the fuel figure used on page 2.",
        "elements": [
            {"path": ("Page header", "Title", ""), "kind": "text", "text": "Fuel Efficiency Trend",
             "font": "Helvetica", "bold": True, "size": 20, "color": NAVY, "case": "Title", "left": 0.75, "top": 0.6},
            {"path": ("Fuel chart", "Graph (image)", ""), "kind": "line_chart", "file": "fuel-trend-chart.png",
             "left": 0.75, "top": 1.3, "width": 6.2, "height": 3.8, "title": "Litres per 100 km, January to September 2026",
             "categories": MONTHS, "values": FUEL, "color": SERIES[0], "y_min": 26, "y_max": 32, "y_step": 1},
            {"path": ("Monthly table", "Table", ""), "kind": "table", "left": 7.35, "top": 1.3,
             "columns": FUEL_COLUMNS, "rows": FUEL_ROWS, "row_pitch": 0.3, "size": 10, "header_fill": NAVY},
            {"path": ("Commentary", "Paragraph", ""), "kind": "paragraph", "text": FUEL_TEXT,
             "font": "Times", "size": 11, "color": ("#111111", "Ink"), "left": 0.75, "top": 5.5, "wrap_at": 10.25,
             "spacing_pt": 15},
            page_number(4),
        ],
    },
]

# (tab, element path, field, new value, what changed, expected result today)
DEVIATIONS = [
    ("1", ("Title block", "Contents", "Report title"), "size", 24, "title 24 pt instead of 28 pt", "Font size FAIL"),
    ("1", ("Title block", "Contents", "Company logo"), "width", 2.0, "logo 0.25 in too wide", "Width FAIL"),
    ("1", ("Title block", "Contents", "Reporting period"), "italic_all", True, "whole line italic, not only \"Quarter\"", "not detectable today"),
    ("1", ("Title block", "Container", ""), "fill", ("#E4E9F2", "changed"), "title block colour changed", "not detectable today"),
    ("2", ("Main content", "Highlights table", ""), "left", 3.45, "table 0.20 in too far right", "Left FAIL"),
    ("2", ("Main content", "Summary", "Paragraph"), "spacing_pt", 12, "line spacing 12 pt instead of 15 pt", "Line spacing FAIL"),
    ("2", ("Main content", "Depot map", "Image"), "height", 2.1, "map 0.30 in shorter", "Height FAIL"),
    ("3", ("Deliveries chart", "Graph", ""), "swap_colours", True, "series colours swapped", "not detectable today"),
    ("3", ("Regional table", "Table", ""), "drop_row", "Central", "Central row missing", "Rows FAIL"),
    ("3", ("Commentary", "Footnote", ""), "text", "On-time means delivered within the booked two-hour window.", "footnote wording changed", "not found"),
    ("4", ("Fuel chart", "Graph (image)", ""), "top", 1.5, "chart 0.20 in lower", "Top FAIL"),
    ("4", ("Footer", "Page number", ""), "omit", True, "page number missing", "not found"),
]


# ─────────────────────────────────────────────────────────────────────────────
# Images
# ─────────────────────────────────────────────────────────────────────────────

def img_cover() -> Image.Image:
    w, h = 2200, 850
    im = Image.new("RGB", (w, h), NAVY[0])
    d = ImageDraw.Draw(im)
    for i, col in enumerate(["#12507A", "#1A6496", "#2A78D6"]):
        x = 900 + i * 380
        d.polygon([(x, 0), (x + 520, 0), (x + 120, h), (x - 400, h)], fill=col)
    pts = [(0, 700)] + [(x, 640 - 120 * math.sin(x / 330.0)) for x in range(0, w + 1, 20)] + [(w, h), (0, h)]
    d.polygon(pts, fill="#0E4A73")
    d.line([(x, 690 - 120 * math.sin(x / 330.0)) for x in range(0, w + 1, 20)], fill="#EB6834", width=10)
    return im


def img_logo() -> Image.Image:
    im = Image.new("RGB", (700, 200), CLOUD[0])
    d = ImageDraw.Draw(im)
    d.polygon([(20, 170), (110, 30), (200, 170)], fill=NAVY[0])
    d.polygon([(80, 170), (150, 70), (220, 170)], fill="#EB6834")
    d.rectangle((260, 55, 670, 90), fill=NAVY[0])
    d.rectangle((260, 115, 560, 140), fill="#7C93A8")
    return im


def img_map() -> Image.Image:
    im = Image.new("RGB", (680, 480), "#F4F6F8")
    d = ImageDraw.Draw(im)
    for x in range(0, 680, 40):
        d.line((x, 0, x, 480), fill="#E3E8EE", width=1)
    for y in range(0, 480, 40):
        d.line((0, y, 680, y), fill="#E3E8EE", width=1)
    depots = {"N": (340, 70), "S": (330, 410), "E": (590, 240), "W": (90, 230), "C": (340, 240)}
    for a in "NSEW":
        d.line((*depots["C"], *depots[a]), fill="#9DB3C8", width=6)
    for k, (x, y) in depots.items():
        r = 28 if k == "C" else 20
        d.ellipse((x - r, y - r, x + r, y + r), fill=NAVY[0] if k != "C" else "#EB6834")
    return im


def img_fuel_chart(el: dict, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(el["width"], el["height"]), dpi=200)
    fig.patch.set_facecolor("#FFFFFF")
    ax.set_facecolor("#FFFFFF")
    ax.plot(el["categories"], el["values"], color=el["color"][0], linewidth=2, marker="o", markersize=6)
    ax.set_ylim(el["y_min"], el["y_max"])
    ax.set_yticks(range(el["y_min"], el["y_max"] + 1, el["y_step"]))
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color("#9CA3AF")
    ax.tick_params(colors="#52514E", labelsize=9, length=0)
    ax.set_title(el["title"], loc="left", fontsize=11, color="#0B0B0B", fontweight="bold", pad=14)
    ax.annotate(f'{el["values"][-1]:.1f}', (len(el["values"]) - 1, el["values"][-1]), textcoords="offset points",
                xytext=(0, 8), ha="center", fontsize=9, color="#0B0B0B")
    fig.tight_layout(pad=0.6)
    fig.savefig(path, format="png", metadata={"Software": None})
    plt.close(fig)


def write_assets(pages: list) -> dict:
    out = HERE / "assets"
    out.mkdir(exist_ok=True)
    made = {"cover-artwork.png": img_cover(), "company-logo.png": img_logo(), "depot-map.png": img_map()}
    for name, im in made.items():
        im.save(out / name, format="PNG")
    for p in pages:
        for el in p["elements"]:
            if el["kind"] == "line_chart":
                img_fuel_chart(el, out / el["file"])
    return {name: out / name for name in [*made, "fuel-trend-chart.png"]}


# ─────────────────────────────────────────────────────────────────────────────
# PDF
# ─────────────────────────────────────────────────────────────────────────────

def y(top_in: float) -> float:
    return (H_IN - top_in) * PT


def table_width(el: dict) -> float:
    return sum(c[1] for c in el["columns"])


def draw_text(c, el):
    size = el["size"]
    lines = el.get("lines", [el["text"]])
    if "bottom" in el:
        base = el["bottom"] * PT
    else:
        base = y(el["top"]) - size
    c.setFillColor(HexColor(el["color"][0]))
    for line in lines:
        italic = el.get("italic", False) or el.get("italic_all", False)
        font = pdf_font(el["font"], el.get("bold", False), italic)
        if "bottom" in el:
            c.setFont(font, size)
            c.drawRightString((W_IN - el["right"]) * PT, base, line)
        elif el.get("italic_word") and not el.get("italic_all") and line.startswith(el["italic_word"]):
            word = el["italic_word"]
            fi = pdf_font(el["font"], el.get("bold", False), True)
            fr = pdf_font(el["font"], el.get("bold", False), False)
            x0 = el["left"] * PT
            c.setFont(fi, size)
            c.drawString(x0, base, word)
            c.setFont(fr, size)
            c.drawString(x0 + stringWidth(word + " ", fr, size), base, line[len(word) + 1:])
        else:
            c.setFont(font, size)
            c.drawString(el["left"] * PT, base, line)
        base -= el.get("spacing_pt", 0)


def draw_paragraph(c, el):
    font = pdf_font(el["font"])
    width = (el["wrap_at"] - el["left"]) * PT
    c.setFillColor(HexColor(el["color"][0]))
    c.setFont(font, el["size"])
    base = y(el["top"]) - el["size"]
    for line in simpleSplit(el["text"], font, el["size"], width):
        c.drawString(el["left"] * PT, base, line)
        base -= el["spacing_pt"]


def draw_table(c, el):
    size = el["size"]
    x0 = el["left"] * PT
    tw = table_width(el) * PT
    rows = [[h for h, _, _ in el["columns"]]] + [r for r in el["rows"] if r[0] != el.get("drop_row")]
    for r, row in enumerate(rows):
        top = el["top"] + r * el["row_pitch"]
        base = y(top) - size
        if r == 0:
            c.setFillColor(HexColor(el["header_fill"][0]))
            c.rect(x0 - 5, base - 0.35 * size - 2, tw + 10, el["row_pitch"] * PT, stroke=0, fill=1)
            c.setFillColor(HexColor("#FFFFFF"))
            font = pdf_font("Helvetica", True)
        else:
            c.setFillColor(HexColor("#111111"))
            font = pdf_font("Helvetica", bold=el.get("bold_last", False) and r == len(rows) - 1)
        c.setFont(font, size)
        x = x0
        for (_, w, align), cell in zip(el["columns"], row):
            if align == "left":
                c.drawString(x, base, cell)
            else:
                c.drawRightString(x + w * PT, base, cell)
            x += w * PT
        if r > 0:
            c.setStrokeColor(HexColor("#D5DDE7"))
            c.setLineWidth(0.5)
            c.line(x0 - 5, base - 0.35 * size - 2, x0 + tw + 5, base - 0.35 * size - 2)


def draw_bar_chart(c, el):
    L, T, Wd, Ht = el["left"], el["top"], el["width"], el["height"]
    series = el["series"]
    if el.get("swap_colours"):
        series = [(series[0][0], series[0][1], series[1][2]), (series[1][0], series[1][1], series[0][2])]
    c.setFillColor(HexColor("#0B0B0B"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(L * PT, y(T) - 11, el["title"])
    plot_l, plot_r = L + 0.65, L + Wd - 0.1
    plot_t, plot_b = T + 0.45, T + Ht - 0.75
    ymax, step = el["y_max"], el["y_step"]

    def yv(v):
        return y(plot_b) + (v / ymax) * (plot_b - plot_t) * PT

    c.setFont("Helvetica", 8)
    for v in range(0, ymax + 1, step):
        c.setStrokeColor(HexColor(GRID if v else "#9CA3AF"))
        c.setLineWidth(0.6)
        c.line(plot_l * PT, yv(v), plot_r * PT, yv(v))
        c.setFillColor(HexColor("#52514E"))
        c.drawRightString((plot_l - 0.08) * PT, yv(v) - 3, f"{v:,}")
    c.saveState()
    c.translate((L + 0.12) * PT, (y(plot_t) + y(plot_b)) / 2)
    c.rotate(90)
    c.drawCentredString(0, 0, el["y_title"])
    c.restoreState()
    n = len(el["categories"])
    band = (plot_r - plot_l) / n
    bar_w = band * 0.32
    gap = 2 / PT
    for i, cat in enumerate(el["categories"]):
        cx = plot_l + band * (i + 0.5)
        for s, (_, vals, col) in enumerate(series):
            x = cx - bar_w - gap / 2 if s == 0 else cx + gap / 2
            c.setFillColor(HexColor(col[0]))
            c.rect(x * PT, yv(0), bar_w * PT, yv(vals[i]) - yv(0), stroke=0, fill=1)
        c.setFillColor(HexColor("#52514E"))
        c.drawCentredString(cx * PT, yv(0) - 12, cat)
    lx = (L + Wd / 2 - 1.3) * PT
    ly = y(T + Ht - 0.2)
    for s, (name, _, col) in enumerate(series):
        c.setFillColor(HexColor(col[0]))
        c.rect(lx, ly, 8, 8, stroke=0, fill=1)
        c.setFillColor(HexColor("#0B0B0B"))
        c.drawString(lx + 12, ly + 1, name)
        lx += 1.3 * PT


def draw_page(c, page, assets):
    for el in page["elements"]:
        if el.get("omit"):
            continue
        k = el["kind"]
        if k == "container":
            c.setFillColor(HexColor(el["fill"][0]))
            c.rect(el["left"] * PT, y(el["top"] + el["height"]), el["width"] * PT, el["height"] * PT, stroke=0, fill=1)
        elif k in ("image", "line_chart"):
            c.drawImage(ImageReader(str(assets[el["file"]])), el["left"] * PT, y(el["top"] + el["height"]),
                        el["width"] * PT, el["height"] * PT)
        elif k == "text":
            draw_text(c, el)
        elif k == "paragraph":
            draw_paragraph(c, el)
        elif k == "table":
            draw_table(c, el)
        elif k == "rule":
            c.setStrokeColor(HexColor(el["color"][0]))
            c.setLineWidth(el["weight_pt"])
            c.line(el["left"] * PT, y(el["top"]), (el["left"] + el["width"]) * PT, y(el["top"]))
        elif k == "bar_chart":
            draw_bar_chart(c, el)


def build_pdf(pages, assets, path: Path, title: str):
    c = canvas.Canvas(str(path), pagesize=(W_IN * PT, H_IN * PT), invariant=1)
    c.setTitle(title)
    c.setAuthor("pdf-testing-suite sample generator")
    for page in pages:
        draw_page(c, page, assets)
        c.showPage()
    c.save()


def apply_deviations(pages):
    out = copy.deepcopy(pages)
    for tab, path, field, value, _, _ in DEVIATIONS:
        page = next(p for p in out if p["tab"] == tab)
        el = next(e for e in page["elements"] if e["path"] == path)
        el[field] = value
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Workbook — nested Element / Parameter / Description layout, prose values
# ─────────────────────────────────────────────────────────────────────────────

def inch(v: float, short: bool = False) -> str:
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    if short and s.startswith("0."):
        s = s[1:]  # ".375 inches", as people often type it
    return s


def colour(c) -> str:
    h = c[0].lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"#{h.upper()} ({c[1]})   R{r} G{g} B{b}"


def yes(v) -> str:
    return "Yes" if v else "No"


def spec_rows(el: dict, i: int) -> list[tuple[str, list[tuple[str, str]]]]:
    """Parameter groups for one element: [(group, [(parameter, description), ...]), ...]."""
    k = el["kind"]
    short = i % 2 == 1  # alternate "0.75" and ".75", as people type them
    align = [("Vertical", f'{inch(el["top"], short)} inches from top of page'),
             ("Horizontal", f'{inch(el["left"], short)} inches from left of page')] if "top" in el else []
    if k == "container":
        return [("Alignment", align),
                ("Size", [("Height", f'{inch(el["height"], short)} inches'), ("Width", f'{inch(el["width"])} inches')]),
                ("Color", [("Hex code", colour(el["fill"]))])]
    if k in ("image",):
        return [("Image", [("File name", el["file"])]),
                ("Size", [("Height", f'{inch(el["height"])} inches'), ("Width", f'{inch(el["width"])} inches')]),
                ("Alignment", align)]
    if k == "text":
        if "bottom" in el:
            align = [("Vertical", f'{inch(el["bottom"])} inches from bottom of page to the text baseline'),
                     ("Horizontal", f'right-aligned, {inch(el["right"])} inches from right of page')]
        text = [("Wording", "<<dynamic>>\n\n" + el["dynamic"] + f'\nSample value: {el["text"]}' if el.get("dynamic") else el["text"])]
        if el.get("line_break"):
            text.append(("Line break", el["line_break"]))
        text += [("Font name", el["font"]), ("Font size", f'{el["size"]:g} pt' if i % 3 else f'{el["size"]:g}'),
                 ("Font color", colour(el["color"]) if el["color"] not in (WHITE,) else "White"),
                 ("Font bold", yes(el.get("bold"))),
                 ("Font italicize", f'Only italicize the word "{el["italic_word"]}"' if el.get("italic_word") else yes(el.get("italic"))),
                 ("Font underline", "No"), ("Font case", el.get("case", "Sentence"))]
        text += el.get("extra", [])
        return [("Alignment", align), ("Text", text)]
    if k == "paragraph":
        return [("Alignment", align[:1] + [("Horizontal", f'{inch(el["left"], short)} inches from left of page\nWrap to next line at {inch(el["wrap_at"])} inches from left of page')]),
                ("Text", [("Wording", el["text"]), ("Font name", el["font"]), ("Font size", f'{el["size"]:g} pt'),
                          ("Font color", colour(el["color"]) if el["color"] != WHITE else "White"),
                          ("Line spacing", f'{el["spacing_pt"]:g} pt baseline to baseline'),
                          ("Font bold", "No"), ("Font italicize", "No"), ("Font case", "Sentence")])]
    if k == "table":
        cols = el["columns"]
        return [("Alignment", align),
                ("Size", [("Width", f"{inch(table_width(el))} inches"), ("Row height", f'{inch(el["row_pitch"])} inches')]),
                ("Table", [("Columns", f"{len(cols)}: " + " | ".join(h for h, _, _ in cols)),
                           ("Column widths", " | ".join(f"{inch(w)} in" for _, w, _ in cols)),
                           ("Column alignment", " | ".join(a for _, _, a in cols)),
                           ("Rows", f'{len(el["rows"]) + 1} including the header row'),
                           ("Header row", f'Helvetica bold {el["size"]:g} pt, white text on {colour(el["header_fill"])}'),
                           ("Body rows", f'Helvetica {el["size"]:g} pt' + ("; last row bold" if el.get("bold_last") else "")),
                           ("Data", "<<dynamic>>\n\nRules: values from the reporting system for the period")])]
    if k == "rule":
        return [("Alignment", align), ("Size", [("Width", f'{inch(el["width"])} inches'), ("Weight", f'{el["weight_pt"]:g} pt')]),
                ("Color", [("Hex code", colour(el["color"]))])]
    if k == "bar_chart":
        return [("Alignment", align),
                ("Size", [("Height", f'{inch(el["height"])} inches'), ("Width", f'{inch(el["width"])} inches')]),
                ("Graph", [("Chart type", "Clustered column, 2 series"), ("Title", f'{el["title"]} (Helvetica bold 11 pt, top left of the graph area)'),
                           ("Categories (x axis)", ", ".join(el["categories"])),
                           *[(f"Series {n + 1}", f"{name}, {colour(col)}") for n, (name, _, col) in enumerate(el["series"])],
                           ("Y axis", f'0 to {el["y_max"]:,} in steps of {el["y_step"]:,}; axis title "{el["y_title"]}"'),
                           ("Gridlines", f"Horizontal only, {GRID}"), ("Legend", "Below the graph, centred"),
                           ("Data", "<<dynamic>>\n\nRules: deliveries per region for this quarter and the previous quarter")])]
    if k == "line_chart":
        return [("Image", [("File name", el["file"] + " (graph rendered as an image)")]),
                ("Alignment", align),
                ("Size", [("Height", f'{inch(el["height"])} inches'), ("Width", f'{inch(el["width"])} inches')]),
                ("Graph", [("Chart type", "Line with markers, 1 series"), ("Title", el["title"]),
                           ("Categories (x axis)", ", ".join(el["categories"])),
                           ("Series 1", f"Litres per 100 km, {colour(el['color'])}"),
                           ("Y axis", f'{el["y_min"]} to {el["y_max"]} in steps of {el["y_step"]}'),
                           ("Legend", "None - one series, named by the title"),
                           ("Data label", "Last point only, one decimal place")])]
    raise ValueError(k)


THIN = Side(style="thin", color="9AA5B1")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
TITLE_FILL = PatternFill("solid", fgColor="C9D3E3")
HEAD_FILL = PatternFill("solid", fgColor="D9DEE5")
NOTE_FILL = PatternFill("solid", fgColor="FFFFFF")
FONT = "Arial"
TYPE_COLOUR = {"Required": "5B9B37", "Optional": "E59A1B", "Conditional": "4F81BD"}


def write_page_sheet(ws, page: dict) -> None:
    for col, w in zip("ABCDEF", (24, 20, 20, 14, 30, 70)):
        ws.column_dimensions[col].width = w
    ws.merge_cells("A1:F1")
    t = ws["A1"]
    t.value = f'Report Page - {page["name"]}'
    t.font = Font(name=FONT, bold=True, size=11)
    t.fill = TITLE_FILL
    t.alignment = Alignment(horizontal="center")
    r = 3
    if page["note"]:
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
        n = ws.cell(row=r, column=1, value="IMPORTANT NOTE:\n" + page["note"])
        n.font = Font(name=FONT, size=10)
        n.alignment = Alignment(wrap_text=True, vertical="top")
        n.border = BOX
        ws.row_dimensions[r].height = 42
        r += 2
    hdr = r
    for col, label in ((1, "Element"), (4, "Parameter"), (6, "Description")):
        ws.cell(row=hdr, column=col, value=label)
    ws.merge_cells(start_row=hdr, start_column=1, end_row=hdr, end_column=3)
    ws.merge_cells(start_row=hdr, start_column=4, end_row=hdr, end_column=5)
    for col in range(1, 7):
        cell = ws.cell(row=hdr, column=col)
        cell.font = Font(name=FONT, bold=True)
        cell.fill = HEAD_FILL
        cell.border = BOX
    ws.freeze_panes = ws.cell(row=hdr + 1, column=1)
    r = hdr + 1

    rows = [("Page orientation", "", "", "", "", "Landscape")]
    for i, el in enumerate(page["elements"]):
        a, b, c = el["path"]
        for group, params in spec_rows(el, i):
            for p, desc in params:
                rows.append((a, b, c, group, p, desc))

    start = r
    for row in rows:
        for col, v in enumerate(row, 1):
            cell = ws.cell(row=r, column=col, value=v or None)
            cell.font = Font(name=FONT, size=10)
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            cell.border = BOX
        lines = sum(max(1, math.ceil(len(seg) / 75)) for seg in str(row[5]).split("\n"))
        if lines > 1:
            ws.row_dimensions[r].height = 13 * lines
        r += 1

    # Merge each hierarchy column over its run of identical values, within its parent's run.
    def merge_runs(col: int, keys: list[int]):
        i = 0
        while i < len(rows):
            j = i
            while j + 1 < len(rows) and all(rows[j + 1][k] == rows[i][k] for k in keys + [col]):
                j += 1
            if j > i and rows[i][col]:
                ws.merge_cells(start_row=start + i, start_column=col + 1, end_row=start + j, end_column=col + 1)
            i = j + 1

    merge_runs(0, [])
    merge_runs(1, [0])
    merge_runs(2, [0, 1])
    merge_runs(3, [0, 1, 2])


def write_index(ws) -> None:
    ws.column_dimensions["A"].width = 6
    ws.column_dimensions["B"].width = 30
    ws.column_dimensions["C"].width = 14
    ws.column_dimensions["D"].width = 14
    ws.column_dimensions["E"].width = 70
    ws.merge_cells("A1:E1")
    ws["A1"].value = "Report Pages List - Fleet Operations Review (SAMPLE - all content is fictional)"
    ws["A1"].font = Font(name=FONT, bold=True, size=11)
    ws["A1"].fill = TITLE_FILL
    for col, h in enumerate(["Tab", "Page name", "Page type", "Orientation", "Comments"], 1):
        c = ws.cell(row=3, column=col, value=h)
        c.font = Font(name=FONT, bold=True)
        c.fill = HEAD_FILL
        c.border = BOX
    for i, p in enumerate(PAGES, 4):
        for col, v in enumerate([p["tab"], p["name"], p["type"], "Landscape", p["comments"] or None], 1):
            c = ws.cell(row=i, column=col, value=v)
            c.font = Font(name=FONT, size=10)
            c.border = BOX
            c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=i, column=1).fill = PatternFill("solid", fgColor=TYPE_COLOUR[p["type"]])
    r = len(PAGES) + 6
    ws.cell(row=r, column=1, value="Tab colour").font = Font(name=FONT, bold=True)
    for k, (t, col) in enumerate(TYPE_COLOUR.items(), 1):
        ws.cell(row=r + k, column=1).fill = PatternFill("solid", fgColor=col)
        ws.cell(row=r + k, column=2, value=t).font = Font(name=FONT, size=10)
    ws.cell(row=r + 5, column=1, value="Measurements: inches from the top-left corner of the page. A text's vertical position is the top of its line.").font = Font(name=FONT, italic=True, size=9)


def build_workbook(path: Path) -> None:
    wb = Workbook()
    idx = wb.active
    idx.title = "Pages List"
    idx.sheet_properties.tabColor = "1F3A5F"
    idx.sheet_properties.pageSetUpPr.fitToPage = True
    idx.page_setup.orientation = "landscape"
    idx.page_setup.fitToWidth = 1
    idx.page_setup.fitToHeight = 0
    write_index(idx)
    for p in PAGES:
        ws = wb.create_sheet(p["tab"])
        ws.sheet_properties.tabColor = TYPE_COLOUR[p["type"]]
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.orientation = "landscape"
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        write_page_sheet(ws, p)
    wb.properties.creator = "pdf-testing-suite sample generator"
    wb.properties.title = "Fleet Operations Review - page specs (sample)"
    wb.properties.created = FIXED_TIME
    wb.properties.modified = FIXED_TIME
    wb.save(path)


def main() -> None:
    assets = write_assets(PAGES)
    build_workbook(HERE / "report-spec.xlsx")
    build_pdf(PAGES, assets, HERE / "report.pdf", "Fleet Operations Review (matches spec)")
    build_pdf(apply_deviations(PAGES), assets, HERE / "report-with-deviations.pdf", "Fleet Operations Review (with deviations)")
    print("wrote report-spec.xlsx, report.pdf, report-with-deviations.pdf, assets/")


if __name__ == "__main__":
    main()
