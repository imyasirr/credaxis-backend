const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const { mapCreditReportForPdf } = require("./pdf.mapper");
const { getUploadPath } = require("../../../middleware/upload.middleware");

const COLORS = {
    ink: "#0F172A",
    muted: "#64748B",
    softMuted: "#94A3B8",
    line: "#E2E8F0",
    soft: "#F8FAFC",
    card: "#FFFFFF",
    brand: "#0F766E",
    brandSoft: "#F0FDFA",
    brandMid: "#99F6E4",
    navy: "#0B1F3A",
    white: "#FFFFFF",
    danger: "#DC2626",
    warn: "#D97706",
    ok: "#0F766E",
    good: "#0D9488",
    excellent: "#059669",
    pillGreenBg: "#DCFCE7",
    pillGreenText: "#166534",
    pillTealBg: "#CCFBF1",
    pillTealText: "#0F766E",
    pillAmberBg: "#FEF3C7",
    pillAmberText: "#B45309",
    pillRedBg: "#FEE2E2",
    pillRedText: "#B91C1C",
};

const MARGIN = 40;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const GAP = 10;
const FOOTER_ZONE = 36;

const toneColor = (tone) => {
    switch (tone) {
        case "danger":
            return COLORS.danger;
        case "warn":
            return COLORS.warn;
        case "excellent":
            return COLORS.excellent;
        case "good":
            return COLORS.good;
        default:
            return COLORS.ok;
    }
};

const pillColors = (tone) => {
    switch (tone) {
        case "danger":
            return { bg: COLORS.pillRedBg, fg: COLORS.pillRedText };
        case "warn":
            return { bg: COLORS.pillAmberBg, fg: COLORS.pillAmberText };
        case "excellent":
        case "good":
            return { bg: COLORS.pillGreenBg, fg: COLORS.pillGreenText };
        default:
            return { bg: COLORS.pillTealBg, fg: COLORS.pillTealText };
    }
};

const ensureDir = () => {
    const { getUploadDir } = require("../../../middleware/upload.middleware");
    return getUploadDir("credit-reports");
};

const slugifyName = (name) => {
    const slug = String(name || "")
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 60);
    return slug || "credit_report";
};

const formatDate = (date) => {
    try {
        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
        }).format(date instanceof Date ? date : new Date(date));
    } catch {
        return String(date);
    }
};

const formatDateTime = (date) => {
    try {
        return new Intl.DateTimeFormat("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
        }).format(date instanceof Date ? date : new Date(date));
    } catch {
        return String(date);
    }
};

const pageBottom = () => PAGE_H - FOOTER_ZONE;

const ensureSpace = (doc, needed = 60) => {
    if (doc.y + needed > pageBottom() - 4) {
        doc.addPage();
        doc.y = MARGIN;
    }
};

const drawCard = (doc, x, y, w, h, options = {}) => {
    doc.save();
    doc.roundedRect(x, y, w, h, options.radius ?? 8)
        .fillAndStroke(options.fill || COLORS.card, options.stroke || COLORS.line);
    doc.restore();
};

const drawPill = (doc, x, y, text, tone = "ok") => {
    const label = String(text || "—");
    const { bg, fg } = pillColors(tone);
    doc.font("Helvetica-Bold").fontSize(7);
    const tw = Math.min(doc.widthOfString(label) + 12, 72);
    doc.save();
    doc.roundedRect(x, y, tw, 13, 6).fill(bg);
    doc.fillColor(fg).text(label, x, y + 3, {
        width: tw,
        align: "center",
        lineBreak: false,
    });
    doc.restore();
    return tw;
};

const drawProgressBar = (doc, x, y, w, pct, tone) => {
    const p = Math.min(100, Math.max(0, Number(pct) || 0));
    doc.save();
    doc.roundedRect(x, y, w, 5, 2.5).fill(COLORS.brandMid);
    if (p > 0) {
        doc.roundedRect(x, y, Math.max(3, (w * p) / 100), 5, 2.5).fill(
            toneColor(tone)
        );
    }
    doc.restore();
};

const textSafe = (doc, str, x, y, opts = {}) => {
    doc.text(String(str ?? "—"), x, y, {
        lineBreak: false,
        ...opts,
    });
};

const drawHeader = (doc, model) => {
    // Top brand bar
    doc.save();
    doc.rect(0, 0, PAGE_W, 52).fill(COLORS.navy);
    doc.restore();

    doc.font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(COLORS.white)
        .text(model.meta.brand || "MyCredAxis", MARGIN, 14, {
            lineBreak: false,
        });
    doc.font("Helvetica")
        .fontSize(8)
        .fillColor("#94A3B8")
        .text("Equifax credit report", MARGIN, 30, { lineBreak: false });

    doc.font("Helvetica")
        .fontSize(7.5)
        .fillColor("#CBD5E1")
        .text(`Report date  ${formatDate(model.meta.generatedAt)}`, MARGIN, 14, {
            width: CONTENT_W,
            align: "right",
            lineBreak: false,
        });
    doc.font("Helvetica")
        .fontSize(7)
        .fillColor("#94A3B8")
        .text(`ID  ${model.meta.referenceId}`, MARGIN, 28, {
            width: CONTENT_W,
            align: "right",
            lineBreak: false,
        });

    doc.y = 68;
    doc.font("Helvetica-Bold")
        .fontSize(18)
        .fillColor(COLORS.ink)
        .text("Credit Report", MARGIN, doc.y, { lineBreak: false });
    doc.y += 22;

    // Identity strip
    const idY = doc.y;
    const idH = 48;
    drawCard(doc, MARGIN, idY, CONTENT_W, idH, {
        fill: COLORS.brandSoft,
        stroke: COLORS.brandMid,
    });
    const cols = [
        { label: "NAME", value: model.personal.fullName },
        { label: "DATE OF BIRTH", value: model.personal.dateOfBirth },
        { label: "PAN", value: model.personal.pan },
    ];
    const colW = CONTENT_W / 3;
    cols.forEach((c, i) => {
        const x = MARGIN + 14 + i * colW;
        doc.font("Helvetica")
            .fontSize(6.5)
            .fillColor(COLORS.brand)
            .text(c.label, x, idY + 11, { lineBreak: false });
        doc.font("Helvetica-Bold")
            .fontSize(9)
            .fillColor(COLORS.ink)
            .text(String(c.value || "—"), x, idY + 24, {
                width: colW - 22,
                ellipsis: true,
                lineBreak: false,
            });
    });
    doc.y = idY + idH + 14;
};

const drawScoreRow = (doc, model) => {
    ensureSpace(doc, 150);
    const y = doc.y;
    const leftW = Math.floor(CONTENT_W * 0.38);
    const rightW = CONTENT_W - GAP - leftW;
    const h = 142;

    drawCard(doc, MARGIN, y, leftW, h);
    drawCard(doc, MARGIN + leftW + GAP, y, rightW, h);

    // Score
    doc.font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text("CREDIT SCORE", MARGIN + 14, y + 12, { lineBreak: false });

    const scoreText =
        model.score.value == null || model.score.value < 0
            ? "N/A"
            : String(model.score.value);

    doc.font("Helvetica-Bold")
        .fontSize(40)
        .fillColor(COLORS.ink)
        .text(scoreText, MARGIN + 14, y + 34, {
            width: leftW - 28,
            align: "center",
            lineBreak: false,
        });

    drawPill(
        doc,
        MARGIN + (leftW - 70) / 2,
        y + 86,
        model.score.bandLabel || "—",
        model.score.bandTone
    );

    doc.font("Helvetica")
        .fontSize(7)
        .fillColor(COLORS.softMuted)
        .text("Range 300 – 900 · Equifax", MARGIN + 14, y + 112, {
            width: leftW - 28,
            align: "center",
            lineBreak: false,
        });

    // Utilization + tip
    const u = model.utilization || {};
    const ux = MARGIN + leftW + GAP + 14;
    doc.font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text("CREDIT UTILIZATION", ux, y + 12, { lineBreak: false });

    doc.font("Helvetica-Bold")
        .fontSize(28)
        .fillColor(toneColor(u.tipTone))
        .text(`${u.usedPct ?? "—"}%`, ux, y + 28, { lineBreak: false });

    doc.font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(`Used  ${u.usedAmount || "—"}`, ux, y + 64, {
            width: rightW - 28,
            lineBreak: false,
        });
    doc.text(`Available  ${u.availableAmount || "—"}`, ux, y + 78, {
        width: rightW - 28,
        lineBreak: false,
    });
    doc.text(`Total limit  ${u.totalLimit || "—"}`, ux, y + 92, {
        width: rightW - 28,
        lineBreak: false,
    });

    if (u.tip) {
        doc.roundedRect(ux, y + 110, rightW - 28, 20, 5).fill(COLORS.brandSoft);
        doc.font("Helvetica")
            .fontSize(6.5)
            .fillColor(COLORS.brand)
            .text(u.tip, ux + 6, y + 116, {
                width: rightW - 40,
                ellipsis: true,
                lineBreak: false,
            });
    }

    doc.y = y + h + 12;
};

const drawFactors = (doc, model) => {
    const factors = (model.score.factors || []).slice(0, 4);
    if (!factors.length) return;

    ensureSpace(doc, 28 + factors.length * 26);
    const y0 = doc.y;
    const h = 24 + factors.length * 26;
    drawCard(doc, MARGIN, y0, CONTENT_W, h);

    doc.font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.ink)
        .text("Score factors", MARGIN + 12, y0 + 10, { lineBreak: false });

    factors.forEach((f, i) => {
        const rowY = y0 + 28 + i * 26;
        const tone =
            f.label === "Needs Work" || f.label === "Poor"
                ? "danger"
                : f.label === "Fair"
                  ? "warn"
                  : "excellent";
        doc.font("Helvetica-Bold")
            .fontSize(8)
            .fillColor(COLORS.ink)
            .text(f.title, MARGIN + 12, rowY, {
                width: 160,
                ellipsis: true,
                lineBreak: false,
            });
        drawProgressBar(doc, MARGIN + 180, rowY + 3, 220, f.pct, tone);
        doc.font("Helvetica")
            .fontSize(7)
            .fillColor(COLORS.muted)
            .text(`${f.pct}%`, MARGIN + 408, rowY, {
                width: 28,
                lineBreak: false,
            });
        drawPill(doc, MARGIN + CONTENT_W - 78, rowY - 1, f.label, tone);
    });

    doc.y = y0 + h + 12;
};

const drawStatsStrip = (doc, model) => {
    ensureSpace(doc, 72);
    const y = doc.y;
    const p = model.paymentSummary || {};
    const items = [
        { label: "On-time", value: `${p.onTimePct ?? "—"}%` },
        { label: "Missed", value: String(p.missedPayments ?? "—") },
        { label: "Active accts", value: String(p.activeAccounts ?? "—") },
        { label: "Cards", value: String(p.creditCards ?? "—") },
        { label: "Loans", value: String(p.loans ?? "—") },
    ];
    const cellW = CONTENT_W / items.length;
    drawCard(doc, MARGIN, y, CONTENT_W, 58);

    items.forEach((item, i) => {
        const x = MARGIN + i * cellW;
        if (i > 0) {
            doc.save();
            doc.moveTo(x, y + 10)
                .lineTo(x, y + 48)
                .strokeColor(COLORS.line)
                .lineWidth(0.5)
                .stroke();
            doc.restore();
        }
        doc.font("Helvetica")
            .fontSize(6.5)
            .fillColor(COLORS.muted)
            .text(item.label.toUpperCase(), x + 8, y + 12, {
                width: cellW - 16,
                align: "center",
                lineBreak: false,
            });
        doc.font("Helvetica-Bold")
            .fontSize(12)
            .fillColor(COLORS.ink)
            .text(item.value, x + 8, y + 28, {
                width: cellW - 16,
                align: "center",
                lineBreak: false,
            });
    });
    doc.y = y + 70;
};

const drawAccounts = (doc, model) => {
    const rows = [...(model.activeAccounts || []), ...(model.closedAccounts || [])].slice(
        0,
        12
    );

    ensureSpace(doc, 50);
    doc.font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.ink)
        .text("Accounts", MARGIN, doc.y, { lineBreak: false });
    doc.y += 14;

    if (!rows.length) {
        drawCard(doc, MARGIN, doc.y, CONTENT_W, 36, { fill: COLORS.soft });
        doc.font("Helvetica")
            .fontSize(8)
            .fillColor(COLORS.muted)
            .text(
                "No retail accounts were returned in this bureau pull.",
                MARGIN + 12,
                doc.y + 12,
                { width: CONTENT_W - 24, lineBreak: false }
            );
        doc.y += 48;
        return;
    }

    const headers = ["Type", "Lender", "Account", "Limit", "Balance", "Status"];
    const widths = [80, 110, 80, 75, 75, 83];

    const drawTableHeader = (y) => {
        doc.rect(MARGIN, y, CONTENT_W, 16).fill(COLORS.navy);
        let x = MARGIN;
        headers.forEach((h, i) => {
            doc.font("Helvetica-Bold")
                .fontSize(6.5)
                .fillColor(COLORS.white)
                .text(h, x + 4, y + 4, {
                    width: widths[i] - 8,
                    lineBreak: false,
                });
            x += widths[i];
        });
        return y + 16;
    };

    let y = drawTableHeader(doc.y);

    rows.forEach((a, idx) => {
        if (y + 18 > pageBottom() - 4) {
            doc.addPage();
            y = drawTableHeader(MARGIN);
        }
        if (idx % 2 === 1) {
            doc.rect(MARGIN, y, CONTENT_W, 18).fill(COLORS.soft);
        }
        const cells = [
            a.accountType,
            a.institution,
            a.accountNumber,
            a.sanction,
            a.balance,
            a.active ? "Active" : a.status || "Closed",
        ];
        let x = MARGIN;
        cells.forEach((cell, i) => {
            if (i === 5) {
                drawPill(
                    doc,
                    x + 4,
                    y + 3,
                    a.active ? "Active" : "Closed",
                    a.active ? "excellent" : "warn"
                );
            } else {
                doc.font("Helvetica")
                    .fontSize(6.5)
                    .fillColor(COLORS.ink)
                    .text(String(cell ?? "—"), x + 4, y + 5, {
                        width: widths[i] - 8,
                        ellipsis: true,
                        lineBreak: false,
                    });
            }
            x += widths[i];
        });
        y += 18;
    });

    doc.y = y + 10;
};

const drawEnquiriesAndPrevious = (doc, model) => {
    ensureSpace(doc, 120);
    const y = doc.y;
    const leftW = (CONTENT_W - GAP) * 0.58;
    const rightW = CONTENT_W - GAP - leftW;
    const enquiries = (model.enquiries || []).slice(0, 4);
    const previous = (model.previousReports || []).slice(0, 4);
    const h = Math.max(
        88,
        36 + Math.max(enquiries.length, previous.length, 1) * 22
    );

    drawCard(doc, MARGIN, y, leftW, h);
    drawCard(doc, MARGIN + leftW + GAP, y, rightW, h);

    doc.font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.ink)
        .text("Recent enquiries", MARGIN + 12, y + 10, { lineBreak: false });

    if (!enquiries.length) {
        doc.font("Helvetica")
            .fontSize(7.5)
            .fillColor(COLORS.muted)
            .text("No recent enquiries.", MARGIN + 12, y + 36, {
                lineBreak: false,
            });
    } else {
        enquiries.forEach((e, i) => {
            const ry = y + 30 + i * 22;
            doc.font("Helvetica-Bold")
                .fontSize(7)
                .fillColor(COLORS.ink)
                .text(e.institution || "—", MARGIN + 12, ry, {
                    width: leftW - 70,
                    ellipsis: true,
                    lineBreak: false,
                });
            doc.font("Helvetica")
                .fontSize(6.5)
                .fillColor(COLORS.muted)
                .text(`${e.purpose || "—"} · ${e.date || "—"}`, MARGIN + 12, ry + 10, {
                    width: leftW - 70,
                    ellipsis: true,
                    lineBreak: false,
                });
            drawPill(
                doc,
                MARGIN + leftW - 48,
                ry + 4,
                e.impact || "Hard",
                e.impact === "Soft" ? "ok" : "warn"
            );
        });
    }

    const rx = MARGIN + leftW + GAP + 12;
    doc.font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.ink)
        .text("Previous scores", rx, y + 10, { lineBreak: false });

    if (!previous.length) {
        doc.font("Helvetica")
            .fontSize(7.5)
            .fillColor(COLORS.muted)
            .text("No previous CredAxis pulls.", rx, y + 36, {
                width: rightW - 24,
                lineBreak: false,
            });
    } else {
        previous.forEach((r, i) => {
            const ry = y + 34 + i * 20;
            doc.font("Helvetica-Bold")
                .fontSize(10)
                .fillColor(COLORS.brand)
                .text(String(r.score ?? "—"), rx, ry, { lineBreak: false });
            doc.font("Helvetica")
                .fontSize(7)
                .fillColor(COLORS.muted)
                .text(r.date || "", rx + 40, ry + 2, {
                    width: rightW - 60,
                    lineBreak: false,
                });
        });
    }

    doc.y = y + h + 12;
};

const drawSummary = (doc, model) => {
    ensureSpace(doc, 90);
    const y = doc.y;
    drawCard(doc, MARGIN, y, CONTENT_W, 78, { fill: COLORS.soft });

    doc.font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.ink)
        .text("Summary", MARGIN + 12, y + 10, { lineBreak: false });

    doc.font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(model.overviewText || "—", MARGIN + 12, y + 26, {
            width: CONTENT_W - 24,
            height: 40,
            ellipsis: true,
        });

    doc.y = y + 90;

    doc.font("Helvetica")
        .fontSize(6.5)
        .fillColor(COLORS.softMuted)
        .text(
            `Checked ${formatDateTime(model.meta.generatedAt)} · Decentro ${model.meta.decentroTxnId}`,
            MARGIN,
            doc.y,
            { width: CONTENT_W, lineBreak: false }
        );
    doc.y += 12;
    doc.text(
        "For informational use only. Figures reflect bureau records at pull time and may differ from lender systems.",
        MARGIN,
        doc.y,
        { width: CONTENT_W, lineBreak: false }
    );
    doc.y += 10;
};

/**
 * Footer on each content page WITHOUT creating extra blank pages.
 * PDFKit auto-paginates if you draw below bottom margin — so margins are
 * zeroed while stamping the footer.
 */
const drawFooter = (doc) => {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(i);
        const saved = { ...doc.page.margins };
        doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };

        doc.save();
        doc.moveTo(MARGIN, PAGE_H - 28)
            .lineTo(PAGE_W - MARGIN, PAGE_H - 28)
            .strokeColor(COLORS.line)
            .lineWidth(0.5)
            .stroke();

        doc.font("Helvetica")
            .fontSize(6.5)
            .fillColor(COLORS.softMuted);
        textSafe(
            doc,
            "MyCredAxis · Equifax via Decentro · Informational only",
            MARGIN,
            PAGE_H - 20,
            { width: CONTENT_W - 90 }
        );
        textSafe(doc, `${i + 1} / ${range.count}`, MARGIN, PAGE_H - 20, {
            width: CONTENT_W,
            align: "right",
        });
        doc.restore();

        doc.page.margins = saved;
    }
};

const renderDocument = (doc, model) => {
    drawHeader(doc, model);
    drawScoreRow(doc, model);
    drawFactors(doc, model);
    drawStatsStrip(doc, model);
    drawAccounts(doc, model);
    drawEnquiriesAndPrevious(doc, model);
    drawSummary(doc, model);
};

/**
 * Build CredAxis-branded PDF from Decentro rawResponse and save to disk.
 * @returns {string|null} public relative path
 */
exports.buildAndSaveCredAxisPdf = async (raw, meta = {}) => {
    const model = mapCreditReportForPdf(raw, meta);
    if (!model) return null;

    const dir = ensureDir();
    const namePart = slugifyName(model.personal.fullName || meta.name);
    const unique =
        String(meta.referenceId || "")
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(-10) || String(Date.now()).slice(-8);
    const filename = `${namePart}_${unique}.pdf`;
    const absolute = path.join(dir, filename);

    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: "A4",
            margins: {
                top: MARGIN,
                bottom: FOOTER_ZONE,
                left: MARGIN,
                right: MARGIN,
            },
            bufferPages: true,
            autoFirstPage: true,
            info: {
                Title: `MyCredAxis Credit Report — ${model.personal.fullName}`,
                Author: "MyCredAxis",
                Subject: "Equifax Credit Report",
            },
        });

        const stream = fs.createWriteStream(absolute);
        doc.pipe(stream);

        try {
            renderDocument(doc, model);
            drawFooter(doc);
            doc.end();
        } catch (err) {
            reject(err);
            return;
        }

        stream.on("finish", resolve);
        stream.on("error", reject);
        doc.on("error", reject);
    });

    return getUploadPath("credit-reports", filename);
};
