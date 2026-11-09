"""Generate a matrix of minimal PDF pairs, each isolating one kind of change.

Every pair differs from its partner in a controlled way so the classifier's
output can be asserted rather than eyeballed.
"""
import os

FONTS = {
    "F1": "Helvetica",
    "F2": "Helvetica-Bold",
    "F3": "Helvetica-Oblique",
    "F4": "Times-Roman",
}


def build_pdf(content_stream: str) -> bytes:
    font_objs = []
    res = []
    for i, (key, base) in enumerate(FONTS.items(), start=4):
        font_objs.append(
            ("<< /Type /Font /Subtype /Type1 /BaseFont /%s >>" % base).encode("latin-1")
        )
        res.append("/%s %d 0 R" % (key, i))

    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        ("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources "
         "<< /Font << %s >> >> /Contents %d 0 R >>"
         % (" ".join(res), 4 + len(FONTS))).encode("latin-1"),
    ]
    objs.extend(font_objs)
    cs = content_stream.encode("latin-1")
    objs.append(b"<< /Length " + str(len(cs)).encode() + b" >>\nstream\n" + cs + b"\nendstream")

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += str(i).encode() + b" 0 obj\n" + body + b"\nendobj\n"
    xref_at = len(out)
    n = len(objs) + 1
    out += b"xref\n0 " + str(n).encode() + b"\n0000000000 65535 f \n"
    for off in offsets[1:]:
        out += ("%010d 00000 n \n" % off).encode()
    out += (b"trailer\n<< /Size " + str(n).encode() + b" /Root 1 0 R >>\nstartxref\n"
            + str(xref_at).encode() + b"\n%%EOF\n")
    return bytes(out)


def line(text, font="F1", size=12, x=72, y=700):
    return "BT /%s %d Tf %d %d Td (%s) Tj ET\n" % (font, size, x, y, text)


SENTENCE = "we took a different approach to this problem"
HEADING = "Quarterly Business Review"

CASES = {
    # ---- no change at all -------------------------------------------------
    "identical": (line(SENTENCE), line(SENTENCE)),

    # ---- 1. TEXT MODIFIED -------------------------------------------------
    "text-word": (line(SENTENCE), line("we took a different strategy to this problem")),
    "text-heading": (line(HEADING, "F2", 18), line("Quarterly Business Summary", "F2", 18)),
    "text-paragraph-line": (
        line("Payment is due within thirty days", y=700) + line("of the statement date", y=684),
        line("Payment is due within sixty days", y=700) + line("of the statement date", y=684),
    ),

    # ---- 2. STYLE CHANGED (text identical) --------------------------------
    "style-bold-whole": (line(SENTENCE, "F1"), line(SENTENCE, "F2")),
    "style-italic-whole": (line(SENTENCE, "F1"), line(SENTENCE, "F3")),
    "style-family-whole": (line(SENTENCE, "F1"), line(SENTENCE, "F4")),
    "style-size-whole": (line(SENTENCE, "F1", 12), line(SENTENCE, "F1", 16)),
    "style-heading": (line(HEADING, "F1", 18), line(HEADING, "F2", 18)),
    "style-midword": (
        line(SENTENCE),
        "BT 72 700 Td /F1 12 Tf (we took a different ) Tj /F2 12 Tf (approach) Tj "
        "/F1 12 Tf ( to this problem) Tj ET\n",
    ),

    # ---- 3. MOVED (text and style identical) ------------------------------
    "move-down": (line(SENTENCE, y=700), line(SENTENCE, y=650)),
    "move-right": (line(SENTENCE, x=72), line(SENTENCE, x=140)),
    "move-both": (line(SENTENCE, x=72, y=700), line(SENTENCE, x=140, y=650)),

    # ---- combinations: which category should win? -------------------------
    "combo-text+style": (
        line(SENTENCE, "F1"),
        line("we took a different strategy to this problem", "F2"),
    ),
    "combo-text+move": (
        line(SENTENCE, y=700),
        line("we took a different strategy to this problem", y=650),
    ),
    "combo-style+move": (line(SENTENCE, "F1", 12, 72, 700), line(SENTENCE, "F2", 12, 72, 650)),
    "combo-all-three": (
        line(SENTENCE, "F1", 12, 72, 700),
        line("we took a different strategy to this problem", "F2", 12, 140, 650),
    ),

    # ---- cascades: one change CAUSES another. Different elements may land in
    # ---- different buckets; the same element must never land in two.
    "cascade-text": (
        line("Introduction to the report", y=700)
        + line("Section one body text here", y=680)
        + line("Section two body text here", y=660)
        + line("Section three body text here", y=640),
        line("Introduction to the summary", y=700)
        + line("Section one body text here", y=670)
        + line("Section two body text here", y=650)
        + line("Section three body text here", y=630),
    ),
    "cascade-style": (
        line("Introduction to the report", "F1", 12, 72, 700)
        + line("Section one body text here", y=680)
        + line("Section two body text here", y=660),
        line("Introduction to the report", "F2", 18, 72, 700)
        + line("Section one body text here", y=670)
        + line("Section two body text here", y=650),
    ),

    # ---- ambiguity: the same words twice, only one instance restyled
    "dup-one-restyled": (
        line("Total amount", "F1", 12, 72, 700) + line("Total amount", "F1", 12, 72, 600),
        line("Total amount", "F1", 12, 72, 700) + line("Total amount", "F2", 12, 72, 600),
    ),

    # ---- a multi-line paragraph with only the middle line restyled
    "para-middle-restyled": (
        line("first line of the paragraph", "F1", 12, 72, 700)
        + line("second line of the paragraph", "F1", 12, 72, 684)
        + line("third line of the paragraph", "F1", 12, 72, 668),
        line("first line of the paragraph", "F1", 12, 72, 700)
        + line("second line of the paragraph", "F3", 12, 72, 684)
        + line("third line of the paragraph", "F1", 12, 72, 668),
    ),

    # ---- a word removed mid-line, shifting the remainder left
    "word-deleted-midline": (
        line("alpha beta gamma delta epsilon"),
        line("alpha gamma delta epsilon"),
    ),

    # ---- text matching is case- and whitespace-insensitive; does a real
    # ---- case change get missed entirely?
    "case-changed": (
        line("Total Amount Due", "F1", 12, 72, 700),
        line("TOTAL AMOUNT DUE", "F1", 12, 72, 700),
    ),

    # ---- the same words twice, only ONE instance moves: can the matcher pair
    # ---- the wrong pair and invent a change?
    "dup-one-moved": (
        line("Total amount", "F1", 12, 72, 700) + line("Total amount", "F1", 12, 72, 600),
        line("Total amount", "F1", 12, 72, 700) + line("Total amount", "F1", 12, 72, 540),
    ),
}

out_dir = os.path.join(os.path.dirname(__file__), "..", ".work", "cases")
os.makedirs(out_dir, exist_ok=True)
for name, (a, b) in CASES.items():
    open(os.path.join(out_dir, name + "-a.pdf"), "wb").write(build_pdf(a))
    open(os.path.join(out_dir, name + "-b.pdf"), "wb").write(build_pdf(b))
print("wrote %d pairs to %s" % (len(CASES), os.path.normpath(out_dir)))
