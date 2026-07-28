const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const { mapCreditReportForPdf } = require("./pdf.mapper");
const { getUploadPath } = require("../../middleware/upload.middleware");

const COLORS = {
    navy: "#0B1F3A",
    navyMid: "#143556",
    accent: "#0D9488",
    ink: "#0F172A",
    muted: "#64748B",
    line: "#E2E8F0",
    soft: "#F8FAFC",
    white: "#FFFFFF",
    danger: "#DC2626",
    warn: "#D97706",
    ok: "#2563EB",
    good: "#0D9488",
    excellent: "#059669",
};

const MARGIN = 42;
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

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

const drawHeader = (doc, model) => {
    doc.save();
    doc.rect(0, 0, PAGE_W, 92).fill(COLORS.navy);

    doc.fillColor(COLORS.white)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("CredAxis", MARGIN, 22, { continued: false });

    doc.font("Helvetica")
        .fontSize(9)
        .fillColor("#94A3B8")
        .text("Credit Intelligence", MARGIN, 48);

    doc.font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(COLORS.white)
        .text("EQUIFAX CREDIT REPORT", MARGIN + 220, 26, {
            width: CONTENT_W - 220,
            align: "right",
        });

    doc.font("Helvetica")
        .fontSize(8)
        .fillColor("#94A3B8")
        .text(`Generated ${formatDateTime(model.meta.generatedAt)}`, MARGIN + 220, 44, {
            width: CONTENT_W - 220,
            align: "right",
        })
        .text(`Ref: ${model.meta.referenceId}`, MARGIN + 220, 56, {
            width: CONTENT_W - 220,
            align: "right",
        });

    doc.restore();
    doc.y = 110;
};

const drawFooter = (doc) => {
    const pageCount = doc.bufferedPageRange();
    for (let i = 0; i < pageCount.count; i += 1) {
        doc.switchToPage(i);
        const pageNo = i + 1;
        doc.save();
        doc.moveTo(MARGIN, PAGE_H - 36)
            .lineTo(PAGE_W - MARGIN, PAGE_H - 36)
            .strokeColor(COLORS.line)
            .lineWidth(0.5)
            .stroke();

        doc.font("Helvetica")
            .fontSize(7)
            .fillColor(COLORS.muted)
            .text(
                "Bureau data courtesy Equifax via CredAxis. For informational use only — not a lending decision.",
                MARGIN,
                PAGE_H - 28,
                { width: CONTENT_W - 80, align: "left" }
            )
            .text(`Page ${pageNo} of ${pageCount.count}`, MARGIN, PAGE_H - 28, {
                width: CONTENT_W,
                align: "right",
            });
        doc.restore();
    }
};

const ensureSpace = (doc, needed = 80) => {
    if (doc.y + needed > PAGE_H - 50) {
        doc.addPage();
        doc.y = MARGIN;
    }
};

const sectionTitle = (doc, title) => {
    ensureSpace(doc, 36);
    const y = doc.y;
    doc.rect(MARGIN, y, 3, 14).fill(COLORS.accent);
    doc.fillColor(COLORS.ink)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(title, MARGIN + 10, y);
    doc.moveTo(MARGIN, y + 18)
        .lineTo(PAGE_W - MARGIN, y + 18)
        .strokeColor(COLORS.line)
        .lineWidth(0.6)
        .stroke();
    doc.y = y + 28;
};

const kvGrid = (doc, pairs, columns = 2) => {
    const items = pairs.filter(Boolean);
    const colW = CONTENT_W / columns;
    let col = 0;

    items.forEach((pair) => {
        if (col === 0) {
            ensureSpace(doc, 32);
        }
        const x = MARGIN + col * colW;
        const y = doc.y;
        doc.font("Helvetica")
            .fontSize(7.5)
            .fillColor(COLORS.muted)
            .text(pair.label.toUpperCase(), x, y, { width: colW - 10 });
        doc.font("Helvetica-Bold")
            .fontSize(9)
            .fillColor(COLORS.ink)
            .text(String(pair.value ?? "—"), x, y + 11, {
                width: colW - 10,
            });
        col += 1;
        if (col >= columns) {
            col = 0;
            doc.y = y + 28;
        }
    });

    if (col !== 0) {
        doc.y += 28;
    }
    doc.y += 6;
};

const drawScoreHero = (doc, score, personal) => {
    ensureSpace(doc, 110);
    const y = doc.y;

    doc.roundedRect(MARGIN, y, CONTENT_W, 96, 6)
        .fill(COLORS.soft)
        .strokeColor(COLORS.line)
        .lineWidth(0.8)
        .stroke();

    const accent = toneColor(score.bandTone);
    doc.roundedRect(MARGIN, y, 118, 96, 6).fill(COLORS.navy);

    const scoreText =
        score.value == null || score.value < 0 ? "N/A" : String(score.value);

    doc.fillColor(COLORS.white)
        .font("Helvetica-Bold")
        .fontSize(scoreText.length > 3 ? 28 : 36)
        .text(scoreText, MARGIN, y + 28, { width: 118, align: "center" });

    doc.font("Helvetica")
        .fontSize(8)
        .fillColor("#94A3B8")
        .text(score.name, MARGIN, y + 68, { width: 118, align: "center" });

    doc.fillColor(COLORS.ink)
        .font("Helvetica-Bold")
        .fontSize(14)
        .text(personal.fullName, MARGIN + 134, y + 16, {
            width: CONTENT_W - 150,
        });

    doc.font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
            `PAN ${personal.pan}  ·  Mobile ${personal.mobile}`,
            MARGIN + 134,
            y + 36,
            { width: CONTENT_W - 150 }
        );

    doc.roundedRect(MARGIN + 134, y + 56, 92, 22, 4).fill(accent);
    doc.fillColor(COLORS.white)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(score.bandLabel.toUpperCase(), MARGIN + 134, y + 62, {
            width: 92,
            align: "center",
        });

    doc.font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text("Score range 300–900", MARGIN + 236, y + 62);

    doc.y = y + 112;
};

const drawTable = (doc, headers, rows, colWidths) => {
    const drawRow = (cells, isHeader, y) => {
        let x = MARGIN;
        const rowH = isHeader ? 18 : 16;
        if (isHeader) {
            doc.rect(MARGIN, y, CONTENT_W, rowH).fill(COLORS.navy);
        } else if (Math.floor((y - doc.y) / rowH) % 2 === 1) {
            // zebra handled via index below
        }
        cells.forEach((cell, i) => {
            const w = colWidths[i];
            doc.font(isHeader ? "Helvetica-Bold" : "Helvetica")
                .fontSize(isHeader ? 7.5 : 7)
                .fillColor(isHeader ? COLORS.white : COLORS.ink)
                .text(String(cell ?? "—"), x + 3, y + 4, {
                    width: w - 6,
                    ellipsis: true,
                    lineBreak: false,
                });
            x += w;
        });
        return rowH;
    };

    ensureSpace(doc, 40);
    let y = doc.y;
    y += drawRow(headers, true, y);

    rows.forEach((row, idx) => {
        if (y + 18 > PAGE_H - 50) {
            doc.addPage();
            y = MARGIN;
            y += drawRow(headers, true, y);
        }
        if (idx % 2 === 1) {
            doc.rect(MARGIN, y, CONTENT_W, 16).fill("#F1F5F9");
        }
        y += drawRow(row, false, y);
        doc.moveTo(MARGIN, y)
            .lineTo(PAGE_W - MARGIN, y)
            .strokeColor(COLORS.line)
            .lineWidth(0.3)
            .stroke();
    });

    doc.y = y + 10;
};

const renderDocument = (doc, model) => {
    drawHeader(doc, model);
    drawScoreHero(doc, model.score, model.personal);

    sectionTitle(doc, "Personal & Identity");
    kvGrid(doc, [
        { label: "Full Name", value: model.personal.fullName },
        { label: "Date of Birth", value: model.personal.dateOfBirth },
        { label: "Gender", value: model.personal.gender },
        { label: "Age", value: model.personal.age },
        { label: "PAN", value: model.personal.pan },
        { label: "Occupation", value: model.personal.occupation },
        { label: "Email", value: model.meta.email || "—" },
        { label: "Provider", value: model.meta.provider },
    ]);

    if (model.personal.phones.length) {
        ensureSpace(doc, 40);
        doc.font("Helvetica-Bold")
            .fontSize(8)
            .fillColor(COLORS.ink)
            .text("Reported phones", MARGIN, doc.y);
        doc.moveDown(0.3);
        doc.font("Helvetica")
            .fontSize(8)
            .fillColor(COLORS.muted)
            .text(
                model.personal.phones
                    .map(
                        (p) =>
                            `${p.number}${p.type ? ` (${p.type})` : ""}`
                    )
                    .join("   ·   "),
                MARGIN,
                doc.y,
                { width: CONTENT_W }
            );
        doc.moveDown(0.8);
    }

    if (model.personal.addresses.length) {
        sectionTitle(doc, "Addresses");
        model.personal.addresses.slice(0, 4).forEach((a, i) => {
            ensureSpace(doc, 36);
            doc.font("Helvetica-Bold")
                .fontSize(8)
                .fillColor(COLORS.ink)
                .text(
                    `${a.type || "Address"} ${i + 1}${
                        a.reportedDate && a.reportedDate !== "—"
                            ? ` · ${a.reportedDate}`
                            : ""
                    }`,
                    MARGIN,
                    doc.y
                );
            doc.font("Helvetica")
                .fontSize(8)
                .fillColor(COLORS.muted)
                .text(
                    [a.address, a.state, a.postal].filter(Boolean).join(", "),
                    MARGIN,
                    doc.y,
                    { width: CONTENT_W }
                );
            doc.moveDown(0.5);
        });
    }

    if (model.summary) {
        sectionTitle(doc, "Accounts Summary");
        kvGrid(doc, [
            { label: "Total Accounts", value: model.summary.noOfAccounts },
            {
                label: "Active Accounts",
                value: model.summary.noOfActiveAccounts,
            },
            { label: "Past Due Accounts", value: model.summary.noOfPastDueAccounts },
            { label: "Write-offs", value: model.summary.noOfWriteOffs },
            {
                label: "Total Balance",
                value: model.summary.totalBalanceAmount,
            },
            {
                label: "Total Sanction",
                value: model.summary.totalSanctionAmount,
            },
            {
                label: "Total Credit Limit",
                value: model.summary.totalCreditLimit,
            },
            { label: "Total Past Due", value: model.summary.totalPastDue },
            {
                label: "Monthly Payment",
                value: model.summary.totalMonthlyPaymentAmount,
            },
            {
                label: "Highest Credit",
                value: model.summary.singleHighestCredit,
            },
            { label: "Oldest Account", value: model.summary.oldestAccount },
            { label: "Recent Account", value: model.summary.recentAccount },
        ], 3);
    }

    if (model.recentActivities) {
        sectionTitle(doc, "Recent Activity");
        kvGrid(
            doc,
            [
                {
                    label: "Accounts Delinquent",
                    value: model.recentActivities.accountsDelinquent,
                },
                {
                    label: "Accounts Opened",
                    value: model.recentActivities.accountsOpened,
                },
                {
                    label: "Total Inquiries",
                    value: model.recentActivities.totalInquiries,
                },
                {
                    label: "Accounts Updated",
                    value: model.recentActivities.accountsUpdated,
                },
            ],
            4
        );
    }

    if (model.score.factors?.length) {
        sectionTitle(doc, "Score Factors");
        model.score.factors.forEach((f, i) => {
            ensureSpace(doc, 16);
            doc.font("Helvetica")
                .fontSize(8)
                .fillColor(COLORS.ink)
                .text(
                    `${i + 1}. ${f.description}${
                        f.code ? `  (${f.code})` : ""
                    }`,
                    MARGIN,
                    doc.y,
                    { width: CONTENT_W }
                );
            doc.moveDown(0.25);
        });
        doc.moveDown(0.4);
    }

    if (model.accounts.length) {
        sectionTitle(doc, `Account Details (${model.accounts.length})`);
        drawTable(
            doc,
            [
                "Institution",
                "Type",
                "Status",
                "Opened",
                "Balance",
                "Past Due",
                "Sanction",
            ],
            model.accounts.map((a) => [
                a.institution,
                a.accountType,
                a.status,
                a.dateOpened,
                a.balance,
                a.pastDue,
                a.sanction,
            ]),
            [105, 70, 55, 60, 70, 65, 86]
        );
    }

    if (model.enquirySummary) {
        sectionTitle(doc, "Enquiry Summary");
        kvGrid(
            doc,
            [
                { label: "Total", value: model.enquirySummary.total },
                { label: "Past 30 Days", value: model.enquirySummary.past30Days },
                {
                    label: "Past 12 Months",
                    value: model.enquirySummary.past12Months,
                },
                {
                    label: "Past 24 Months",
                    value: model.enquirySummary.past24Months,
                },
                { label: "Most Recent", value: model.enquirySummary.recent },
                { label: "Purpose", value: model.enquirySummary.purpose },
            ],
            3
        );
    }

    if (model.enquiries.length) {
        sectionTitle(doc, `Recent Enquiries (${model.enquiries.length})`);
        drawTable(
            doc,
            ["Institution", "Date", "Purpose"],
            model.enquiries.map((e) => [
                e.institution,
                e.date,
                e.purpose,
            ]),
            [260, 100, 151]
        );
    }

    ensureSpace(doc, 50);
    doc.font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(
            "This CredAxis credit report is generated from Equifax bureau data returned via Decentro. " +
                "Figures and statuses reflect bureau records as of the pull time and may differ from lender systems. " +
                `Txn: ${model.meta.decentroTxnId}`,
            MARGIN,
            doc.y,
            { width: CONTENT_W, align: "left" }
        );
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
                bottom: 48,
                left: MARGIN,
                right: MARGIN,
            },
            bufferPages: true,
            info: {
                Title: `CredAxis Credit Report — ${model.personal.fullName}`,
                Author: "CredAxis",
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
