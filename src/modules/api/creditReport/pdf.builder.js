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
    blue: "#2563EB",
    blueSoft: "#EFF6FF",
    blueMid: "#DBEAFE",
    navy: "#0B1F3A",
    white: "#FFFFFF",
    danger: "#DC2626",
    warn: "#D97706",
    ok: "#2563EB",
    good: "#0D9488",
    excellent: "#059669",
    pillGreenBg: "#DCFCE7",
    pillGreenText: "#166534",
    pillBlueBg: "#DBEAFE",
    pillBlueText: "#1D4ED8",
    pillAmberBg: "#FEF3C7",
    pillAmberText: "#B45309",
    pillRedBg: "#FEE2E2",
    pillRedText: "#B91C1C",
    tipBg: "#EFF6FF",
};

const MARGIN = 36;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const GAP = 10;
const FOOTER_H = 40;

const toneColor = (tone) => {
    switch (tone) {
        case "danger":
            return COLORS.danger;
        case "warn":
            return COLORS.warn;
        case "ok":
            return COLORS.ok;
        case "good":
            return COLORS.good;
        case "excellent":
            return COLORS.excellent;
        default:
            return COLORS.muted;
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
            return { bg: COLORS.pillBlueBg, fg: COLORS.pillBlueText };
    }
};

const ensureDir = () => {
    const dir = path.join(
        __dirname,
        "../../../public/uploads/credit-reports"
    );
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
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

const ensureSpace = (doc, needed = 80) => {
    if (doc.y + needed > PAGE_H - FOOTER_H - 8) {
        doc.addPage();
        doc.y = MARGIN;
    }
};

const drawCard = (doc, x, y, w, h, options = {}) => {
    const fill = options.fill || COLORS.card;
    const radius = options.radius ?? 10;
    doc.save();
    doc.roundedRect(x, y, w, h, radius)
        .fillAndStroke(fill, options.stroke || COLORS.line);
    doc.restore();
};

const drawPill = (doc, x, y, text, tone = "ok") => {
    const label = String(text || "—");
    const { bg, fg } = pillColors(tone);
    doc.font("Helvetica-Bold").fontSize(7);
    const tw = doc.widthOfString(label) + 12;
    const th = 13;
    doc.save();
    doc.roundedRect(x, y, tw, th, 6).fill(bg);
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
    doc.roundedRect(x, y, w, 6, 3).fill(COLORS.blueMid);
    if (p > 0) {
        doc.roundedRect(x, y, Math.max(4, (w * p) / 100), 6, 3).fill(
            toneColor(tone)
        );
    }
    doc.restore();
};

const drawSemiGauge = (doc, cx, cy, radius, score, tone) => {
    const min = 300;
    const max = 900;
    const value =
        score == null || score < 0
            ? min
            : Math.min(max, Math.max(min, Number(score)));
    const pct = (value - min) / (max - min);

    const start = Math.PI;
    const end = 0;
    const valueAngle = start + (end - start) * pct;

    const drawArc = (from, to, color, width) => {
        doc.save();
        doc.lineWidth(width)
            .strokeColor(color)
            .lineCap("round");
        doc.path(
            `M ${cx + radius * Math.cos(from)} ${
                cy + radius * Math.sin(from)
            } A ${radius} ${radius} 0 0 1 ${cx + radius * Math.cos(to)} ${
                cy + radius * Math.sin(to)
            }`
        ).stroke();
        doc.restore();
    };

    drawArc(start, end, COLORS.blueMid, 12);
    if (pct > 0.01) {
        drawArc(start, valueAngle, toneColor(tone), 12);
    }
};

const drawDonut = (doc, cx, cy, radius, usedPct, tone) => {
    const pct = Math.min(100, Math.max(0, Number(usedPct) || 0)) / 100;
    const start = -Math.PI / 2;
    const usedEnd = start + Math.PI * 2 * pct;

    const ring = (from, to, color, width) => {
        if (to <= from) return;
        doc.save();
        doc.lineWidth(width).strokeColor(color).lineCap("butt");
        const large = to - from > Math.PI ? 1 : 0;
        doc.path(
            `M ${cx + radius * Math.cos(from)} ${
                cy + radius * Math.sin(from)
            } A ${radius} ${radius} 0 ${large} 1 ${
                cx + radius * Math.cos(to)
            } ${cy + radius * Math.sin(to)}`
        ).stroke();
        doc.restore();
    };

    ring(start, start + Math.PI * 2, COLORS.blueMid, 14);
    if (pct > 0) {
        ring(start, usedEnd, toneColor(tone), 14);
    }
};

const drawHeader = (doc, model) => {
    const y = MARGIN;
    doc.font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(COLORS.blue)
        .text(model.meta.brand || "MyCredAxis", MARGIN, y);

    doc.font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(`Report Date`, PAGE_W - MARGIN - 160, y, {
            width: 160,
            align: "right",
        });
    doc.font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.ink)
        .text(formatDate(model.meta.generatedAt), PAGE_W - MARGIN - 160, y + 11, {
            width: 160,
            align: "right",
        });
    doc.font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLORS.softMuted)
        .text(`Report ID: ${model.meta.referenceId}`, PAGE_W - MARGIN - 160, y + 24, {
            width: 160,
            align: "right",
        });

    doc.y = y + 44;
    doc.font("Times-Bold")
        .fontSize(26)
        .fillColor(COLORS.ink)
        .text("CREDIT REPORT", MARGIN, doc.y, { width: CONTENT_W });

    doc.font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
            "Comprehensive overview of your credit profile and history.",
            MARGIN,
            doc.y + 2,
            { width: CONTENT_W }
        );

    doc.y += 18;
    const cardY = doc.y;
    const cardH = 42;
    drawCard(doc, MARGIN, cardY, CONTENT_W, cardH, {
        fill: COLORS.blueSoft,
        stroke: COLORS.blueMid,
    });

    const colW = CONTENT_W / 3;
    const rows = [
        { label: "NAME", value: model.personal.fullName },
        { label: "DATE OF BIRTH", value: model.personal.dateOfBirth },
        { label: "PAN", value: model.personal.pan },
    ];
    rows.forEach((row, i) => {
        const x = MARGIN + 12 + i * colW;
        doc.font("Helvetica")
            .fontSize(7)
            .fillColor(COLORS.blue)
            .text(row.label, x, cardY + 9, { width: colW - 16 });
        doc.font("Helvetica-Bold")
            .fontSize(9)
            .fillColor(COLORS.ink)
            .text(String(row.value || "—"), x, cardY + 21, {
                width: colW - 16,
                ellipsis: true,
                lineBreak: false,
            });
    });

    doc.y = cardY + cardH + 14;
};

const drawScoreAndFactors = (doc, model) => {
    ensureSpace(doc, 175);
    const y = doc.y;
    const leftW = (CONTENT_W - GAP) * 0.48;
    const rightW = CONTENT_W - GAP - leftW;
    const h = 168;

    drawCard(doc, MARGIN, y, leftW, h);
    drawCard(doc, MARGIN + leftW + GAP, y, rightW, h);

    doc.font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.ink)
        .text("Credit Score Overview", MARGIN + 12, y + 12);

    const cx = MARGIN + leftW / 2;
    const cy = y + 88;
    drawSemiGauge(
        doc,
        cx,
        cy,
        52,
        model.score.value,
        model.score.bandTone
    );

    const scoreText =
        model.score.value == null || model.score.value < 0
            ? "N/A"
            : String(model.score.value);

    doc.font("Helvetica-Bold")
        .fontSize(26)
        .fillColor(COLORS.ink)
        .text(scoreText, MARGIN + 12, y + 72, {
            width: leftW - 24,
            align: "center",
        });
    doc.font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(toneColor(model.score.bandTone))
        .text(model.score.bandLabel, MARGIN + 12, y + 100, {
            width: leftW - 24,
            align: "center",
        });
    doc.font("Helvetica")
        .fontSize(7)
        .fillColor(COLORS.softMuted)
        .text("Score range 300 – 900", MARGIN + 12, y + 114, {
            width: leftW - 24,
            align: "center",
        });

    doc.roundedRect(MARGIN + 18, y + 132, leftW - 36, 22, 6).fill(
        COLORS.blueSoft
    );
    doc.font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLORS.blue)
        .text(
            `${model.score.name} · Equifax via CredAxis`,
            MARGIN + 18,
            y + 139,
            { width: leftW - 36, align: "center" }
        );

    // Factors
    const fx = MARGIN + leftW + GAP + 12;
    doc.font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.ink)
        .text("Score Factors Summary", fx, y + 12);

    const factors = (model.score.factors || []).slice(0, 4);
    factors.forEach((f, i) => {
        const rowY = y + 34 + i * 32;
        doc.font("Helvetica-Bold")
            .fontSize(8)
            .fillColor(COLORS.ink)
            .text(f.title, fx, rowY, { width: rightW - 90, lineBreak: false });
        doc.font("Helvetica")
            .fontSize(7)
            .fillColor(COLORS.muted)
            .text(`${f.pct}%`, fx + rightW - 88, rowY, {
                width: 28,
                align: "right",
            });
        drawPill(doc, fx + rightW - 56, rowY - 1, f.label, f.label === "Excellent" || f.label === "Very Good" || f.label === "Good" ? "excellent" : f.label === "Fair" ? "warn" : "danger");
        drawProgressBar(
            doc,
            fx,
            rowY + 14,
            rightW - 28,
            f.pct,
            f.label === "Needs Work" || f.label === "Poor"
                ? "danger"
                : f.label === "Fair"
                  ? "warn"
                  : "excellent"
        );
    });

    doc.y = y + h + 12;
};

const drawTrendAndUtilization = (doc, model) => {
    ensureSpace(doc, 170);
    const y = doc.y;
    const leftW = (CONTENT_W - GAP) * 0.52;
    const rightW = CONTENT_W - GAP - leftW;
    const h = 158;

    drawCard(doc, MARGIN, y, leftW, h);
    drawCard(doc, MARGIN + leftW + GAP, y, rightW, h);

    doc.font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.ink)
        .text("Score Snapshot", MARGIN + 12, y + 12);

    const trend = model.score.trend || [];
    if (trend.length <= 1) {
        doc.font("Helvetica")
            .fontSize(8)
            .fillColor(COLORS.muted)
            .text(
                "Historical monthly trend is not available from this bureau pull. Current score is shown below.",
                MARGIN + 12,
                y + 36,
                { width: leftW - 24 }
            );
        const score =
            model.score.value == null || model.score.value < 0
                ? "N/A"
                : String(model.score.value);
        doc.font("Helvetica-Bold")
            .fontSize(32)
            .fillColor(COLORS.blue)
            .text(score, MARGIN + 12, y + 78, {
                width: leftW - 24,
                align: "center",
            });
        doc.font("Helvetica")
            .fontSize(8)
            .fillColor(COLORS.muted)
            .text(model.score.bandLabel, MARGIN + 12, y + 118, {
                width: leftW - 24,
                align: "center",
            });
    } else {
        // Simple polyline if multiple points ever provided
        const plotX = MARGIN + 20;
        const plotY = y + 40;
        const plotW = leftW - 40;
        const plotH = 90;
        const values = trend.map((t) => Number(t.value));
        const minV = Math.min(...values, 300);
        const maxV = Math.max(...values, 900);
        const points = trend.map((t, i) => {
            const px =
                plotX +
                (trend.length === 1
                    ? plotW / 2
                    : (i / (trend.length - 1)) * plotW);
            const py =
                plotY +
                plotH -
                ((Number(t.value) - minV) / Math.max(1, maxV - minV)) * plotH;
            return { x: px, y: py, label: t.label, value: t.value };
        });
        doc.save();
        doc.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((p) => doc.lineTo(p.x, p.y));
        doc.strokeColor(COLORS.blue).lineWidth(1.5).stroke();
        points.forEach((p) => {
            doc.circle(p.x, p.y, 2.5).fill(COLORS.blue);
            doc.font("Helvetica")
                .fontSize(6)
                .fillColor(COLORS.muted)
                .text(String(p.value), p.x - 10, p.y - 12, {
                    width: 20,
                    align: "center",
                });
        });
        doc.restore();
    }

    // Utilization
    const ux = MARGIN + leftW + GAP;
    doc.font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.ink)
        .text("Credit Utilization", ux + 12, y + 12);

    if (!model.utilization) {
        doc.font("Helvetica")
            .fontSize(8)
            .fillColor(COLORS.muted)
            .text(
                "Utilization could not be calculated from available bureau limits.",
                ux + 12,
                y + 48,
                { width: rightW - 24 }
            );
    } else {
        const u = model.utilization;
        const dcx = ux + 52;
        const dcy = y + 78;
        drawDonut(doc, dcx, dcy, 34, u.usedPct, u.tipTone);
        doc.font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(COLORS.ink)
            .text(`${u.usedPct}%`, dcx - 22, dcy - 8, {
                width: 44,
                align: "center",
            });
        doc.font("Helvetica")
            .fontSize(6)
            .fillColor(COLORS.muted)
            .text("Used", dcx - 22, dcy + 8, {
                width: 44,
                align: "center",
            });

        const lx = ux + 100;
        const legend = [
            { label: "Used", value: u.usedAmount },
            { label: "Available", value: u.availableAmount },
            { label: "Total Limit", value: u.totalLimit },
        ];
        legend.forEach((item, i) => {
            const ly = y + 40 + i * 22;
            doc.circle(lx, ly + 4, 3).fill(
                i === 0 ? toneColor(u.tipTone) : COLORS.blueMid
            );
            doc.font("Helvetica")
                .fontSize(7)
                .fillColor(COLORS.muted)
                .text(item.label, lx + 8, ly);
            doc.font("Helvetica-Bold")
                .fontSize(8)
                .fillColor(COLORS.ink)
                .text(item.value, lx + 8, ly + 9);
        });

        doc.roundedRect(ux + 12, y + 126, rightW - 24, 22, 6).fill(
            COLORS.tipBg
        );
        doc.font("Helvetica")
            .fontSize(7)
            .fillColor(COLORS.blue)
            .text(u.tip, ux + 18, y + 133, {
                width: rightW - 36,
                ellipsis: true,
                lineBreak: false,
            });
    }

    doc.y = y + h + 12;
};

const drawAccountsSection = (doc, model) => {
    const renderGroup = (title, rows) => {
        if (!rows.length) return;
        ensureSpace(doc, 60);
        doc.font("Helvetica-Bold")
            .fontSize(10)
            .fillColor(COLORS.ink)
            .text(title, MARGIN, doc.y);
        doc.moveDown(0.4);

        const headers = [
            "Type",
            "Institution",
            "Account",
            "Limit / Loan",
            "Balance",
            "Status",
            "Behaviour",
        ];
        const widths = [70, 95, 70, 70, 70, 55, 71];
        ensureSpace(doc, 30);
        let y = doc.y;
        doc.rect(MARGIN, y, CONTENT_W, 16).fill(COLORS.navy);
        let x = MARGIN;
        headers.forEach((h, i) => {
            doc.font("Helvetica-Bold")
                .fontSize(6.5)
                .fillColor(COLORS.white)
                .text(h, x + 3, y + 4, {
                    width: widths[i] - 6,
                    lineBreak: false,
                });
            x += widths[i];
        });
        y += 16;

        rows.slice(0, 40).forEach((a, idx) => {
            if (y + 20 > PAGE_H - FOOTER_H - 8) {
                doc.addPage();
                y = MARGIN;
                doc.rect(MARGIN, y, CONTENT_W, 16).fill(COLORS.navy);
                x = MARGIN;
                headers.forEach((h, i) => {
                    doc.font("Helvetica-Bold")
                        .fontSize(6.5)
                        .fillColor(COLORS.white)
                        .text(h, x + 3, y + 4, {
                            width: widths[i] - 6,
                            lineBreak: false,
                        });
                    x += widths[i];
                });
                y += 16;
            }
            if (idx % 2 === 1) {
                doc.rect(MARGIN, y, CONTENT_W, 18).fill(COLORS.soft);
            }
            const cells = [
                a.accountType,
                a.institution,
                a.accountNumber,
                a.sanction,
                a.usedPct != null
                    ? `${a.balance} (${a.usedPct}%)`
                    : a.balance,
                a.active ? "Active" : a.status || "Closed",
                a.behaviour?.label || "—",
            ];
            x = MARGIN;
            cells.forEach((cell, i) => {
                if (i === 5) {
                    drawPill(
                        doc,
                        x + 2,
                        y + 3,
                        a.active ? "Active" : "Closed",
                        a.active ? "excellent" : "muted"
                    );
                } else if (i === 6) {
                    drawPill(
                        doc,
                        x + 2,
                        y + 3,
                        a.behaviour?.label || "—",
                        a.behaviour?.tone || "ok"
                    );
                } else {
                    doc.font("Helvetica")
                        .fontSize(6.5)
                        .fillColor(COLORS.ink)
                        .text(String(cell ?? "—"), x + 3, y + 5, {
                            width: widths[i] - 6,
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

    ensureSpace(doc, 40);
    doc.font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(COLORS.ink)
        .text("Account Details", MARGIN, doc.y);
    doc.moveDown(0.35);

    renderGroup(
        `Active Accounts (${model.activeAccounts.length})`,
        model.activeAccounts
    );
    renderGroup(
        `Closed Accounts (${model.closedAccounts.length})`,
        model.closedAccounts
    );

    if (!model.accounts.length) {
        doc.font("Helvetica")
            .fontSize(8)
            .fillColor(COLORS.muted)
            .text("No retail accounts were returned in this bureau pull.", MARGIN, doc.y);
        doc.moveDown(0.8);
    }
};

const drawBottomCards = (doc, model) => {
    ensureSpace(doc, 180);
    const y = doc.y;
    const colW = (CONTENT_W - GAP * 2) / 3;
    const h = 168;
    const previous = model.previousReports || [];

    const drawBox = (index, title, render) => {
        const x = MARGIN + index * (colW + GAP);
        drawCard(doc, x, y, colW, h);
        doc.font("Helvetica-Bold")
            .fontSize(9)
            .fillColor(COLORS.ink)
            .text(title, x + 10, y + 10, { width: colW - 20 });
        render(x, y);
    };

    drawBox(0, "Recent Enquiries", (x, boxY) => {
        const rows = (model.enquiries || []).slice(0, 5);
        if (!rows.length) {
            doc.font("Helvetica")
                .fontSize(7.5)
                .fillColor(COLORS.muted)
                .text("No recent enquiries.", x + 10, boxY + 36, {
                    width: colW - 20,
                });
            return;
        }
        rows.forEach((e, i) => {
            const ry = boxY + 30 + i * 24;
            doc.font("Helvetica-Bold")
                .fontSize(7)
                .fillColor(COLORS.ink)
                .text(e.institution, x + 10, ry, {
                    width: colW - 50,
                    ellipsis: true,
                    lineBreak: false,
                });
            doc.font("Helvetica")
                .fontSize(6.5)
                .fillColor(COLORS.muted)
                .text(`${e.purpose} · ${e.date}`, x + 10, ry + 10, {
                    width: colW - 50,
                    ellipsis: true,
                    lineBreak: false,
                });
            drawPill(
                doc,
                x + colW - 42,
                ry + 2,
                e.impact || "Hard",
                e.impact === "Soft" ? "ok" : "warn"
            );
        });
    });

    drawBox(1, "Payment History Summary", (x, boxY) => {
        const p = model.paymentSummary || {};
        const items = [
            { label: "On-time Payments", value: `${p.onTimePct ?? "—"}%` },
            { label: "Missed Payments", value: String(p.missedPayments ?? "—") },
            { label: "Active Accounts", value: String(p.activeAccounts ?? "—") },
            { label: "Oldest Account", value: String(p.oldestAccount ?? "—") },
            { label: "Credit Cards", value: String(p.creditCards ?? "—") },
            { label: "Loans", value: String(p.loans ?? "—") },
        ];
        items.forEach((item, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const ix = x + 10 + col * ((colW - 16) / 2);
            const iy = boxY + 32 + row * 40;
            doc.roundedRect(ix, iy, (colW - 24) / 2, 34, 6).fill(COLORS.soft);
            doc.font("Helvetica")
                .fontSize(6.5)
                .fillColor(COLORS.muted)
                .text(item.label, ix + 6, iy + 6, {
                    width: (colW - 24) / 2 - 10,
                });
            doc.font("Helvetica-Bold")
                .fontSize(9)
                .fillColor(COLORS.ink)
                .text(item.value, ix + 6, iy + 17, {
                    width: (colW - 24) / 2 - 10,
                    ellipsis: true,
                    lineBreak: false,
                });
        });
    });

    drawBox(2, previous.length ? "Previous Reports" : "Report Meta", (x, boxY) => {
        if (previous.length) {
            previous.slice(0, 5).forEach((item, i) => {
                const ly = boxY + 32 + i * 24;
                doc.font("Helvetica-Bold")
                    .fontSize(8)
                    .fillColor(COLORS.ink)
                    .text(String(item.score ?? "—"), x + 10, ly, {
                        width: 36,
                    });
                doc.font("Helvetica")
                    .fontSize(7)
                    .fillColor(COLORS.muted)
                    .text(String(item.date || "—"), x + 48, ly + 1, {
                        width: colW - 60,
                        ellipsis: true,
                        lineBreak: false,
                    });
            });
            return;
        }

        const lines = [
            { label: "Provider", value: model.meta.provider },
            { label: "Generated", value: formatDateTime(model.meta.generatedAt) },
            { label: "Reference", value: model.meta.referenceId },
            {
                label: "Enquiries (30d)",
                value: model.enquirySummary?.past30Days || "—",
            },
            {
                label: "Enquiries (12m)",
                value: model.enquirySummary?.past12Months || "—",
            },
            {
                label: "Total Accounts",
                value: model.summary?.noOfAccounts || model.accounts.length,
            },
        ];
        lines.forEach((line, i) => {
            const ly = boxY + 32 + i * 20;
            doc.font("Helvetica")
                .fontSize(7)
                .fillColor(COLORS.muted)
                .text(line.label, x + 10, ly, { width: 70 });
            doc.font("Helvetica-Bold")
                .fontSize(7.5)
                .fillColor(COLORS.ink)
                .text(String(line.value), x + 80, ly, {
                    width: colW - 92,
                    ellipsis: true,
                    lineBreak: false,
                });
        });
    });

    doc.y = y + h + 12;
};

const drawClosing = (doc, model) => {
    ensureSpace(doc, 120);
    drawCard(doc, MARGIN, doc.y, CONTENT_W, 28, {
        fill: COLORS.soft,
        radius: 8,
    });
    doc.font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
            `Last checked: ${formatDateTime(model.meta.generatedAt)}  ·  Decentro Txn: ${model.meta.decentroTxnId}`,
            MARGIN + 12,
            doc.y + 9,
            { width: CONTENT_W - 24 }
        );
    doc.y += 40;

    ensureSpace(doc, 70);
    drawCard(doc, MARGIN, doc.y, CONTENT_W, 36, {
        fill: COLORS.tipBg,
        stroke: COLORS.blueMid,
        radius: 8,
    });
    doc.font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(COLORS.blue)
        .text("Tip", MARGIN + 12, doc.y + 8);
    doc.font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLORS.ink)
        .text(
            model.utilization?.tip ||
                "Pay EMIs on time and keep credit utilization low to strengthen your score.",
            MARGIN + 12,
            doc.y + 19,
            { width: CONTENT_W - 24 }
        );
    doc.y += 48;

    ensureSpace(doc, 90);
    doc.font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.ink)
        .text("Overall Summary", MARGIN, doc.y);
    doc.moveDown(0.3);
    doc.font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(model.overviewText || "—", MARGIN, doc.y, {
            width: CONTENT_W,
            align: "left",
        });
    doc.moveDown(0.8);

    ensureSpace(doc, 70);
    doc.font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.ink)
        .text("Notes", MARGIN, doc.y);
    doc.moveDown(0.25);
    const notes = [
        "This CredAxis report is generated from Equifax bureau data returned via Decentro.",
        "Figures reflect bureau records as of the pull time and may differ from lender systems.",
        "This document is for informational use only and is not a lending decision.",
    ];
    notes.forEach((n) => {
        doc.font("Helvetica")
            .fontSize(7.5)
            .fillColor(COLORS.muted)
            .text(`•  ${n}`, MARGIN, doc.y, { width: CONTENT_W });
        doc.moveDown(0.2);
    });
};

const drawFooter = (doc) => {
    const pageCount = doc.bufferedPageRange();
    for (let i = 0; i < pageCount.count; i += 1) {
        doc.switchToPage(i);
        doc.save();
        doc.moveTo(MARGIN, PAGE_H - 32)
            .lineTo(PAGE_W - MARGIN, PAGE_H - 32)
            .strokeColor(COLORS.line)
            .lineWidth(0.5)
            .stroke();
        doc.font("Helvetica")
            .fontSize(7)
            .fillColor(COLORS.muted)
            .text(
                "MyCredAxis · Equifax credit data via Decentro · Informational use only",
                MARGIN,
                PAGE_H - 24,
                { width: CONTENT_W - 80 }
            )
            .text(`Page ${i + 1} of ${pageCount.count}`, MARGIN, PAGE_H - 24, {
                width: CONTENT_W,
                align: "right",
            });
        doc.restore();
    }
};

const renderDocument = (doc, model) => {
    drawHeader(doc, model);
    drawScoreAndFactors(doc, model);
    drawTrendAndUtilization(doc, model);
    drawAccountsSection(doc, model);
    drawBottomCards(doc, model);
    drawClosing(doc, model);
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
                bottom: FOOTER_H,
                left: MARGIN,
                right: MARGIN,
            },
            bufferPages: true,
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
