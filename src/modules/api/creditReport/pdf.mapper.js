/**
 * Normalize Equifax CIR rawResponse into a stable view-model for PDF rendering.
 * Tolerant of missing sections and mixed casing. Adds computed cards:
 * utilization, active/closed accounts, payment summary, factor bars.
 */

const pick = (obj, keys, fallback = undefined) => {
    if (!obj || typeof obj !== "object") return fallback;
    for (const key of keys) {
        if (obj[key] != null && obj[key] !== "") return obj[key];
    }
    return fallback;
};

const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
};

const str = (value, fallback = "—") => {
    if (value == null || value === "") return fallback;
    return String(value).trim() || fallback;
};

const numOrNull = (value) => {
    if (value == null || value === "") return null;
    const n = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
};

const formatAmount = (value) => {
    const n = numOrNull(value);
    if (n == null) return str(value);
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(n);
};

const scoreBand = (score) => {
    if (score == null || score < 0) {
        return { label: "No History", tone: "muted", pct: 0 };
    }
    if (score < 550) return { label: "Poor", tone: "danger", pct: 35 };
    if (score < 650) return { label: "Fair", tone: "warn", pct: 52 };
    if (score < 750) return { label: "Good", tone: "ok", pct: 72 };
    if (score < 800) return { label: "Very Good", tone: "good", pct: 84 };
    return { label: "Excellent", tone: "excellent", pct: 94 };
};

const isActiveStatus = (status) => {
    const s = String(status || "").toLowerCase();
    if (!s || s === "—") return true;
    if (
        /closed|written.?off|settled|sold|charge.?off|inactive|terminated/.test(
            s
        )
    ) {
        return false;
    }
    return true;
};

const behaviourFromAccount = (account) => {
    const pastDue = numOrNull(account.pastDueRaw);
    const status = String(account.status || "").toLowerCase();
    if (pastDue != null && pastDue > 0) {
        if (pastDue > 10000) return { label: "Poor", tone: "danger" };
        return { label: "Fair", tone: "warn" };
    }
    if (/write.?off|settled|suit|wilful/.test(status)) {
        return { label: "Poor", tone: "danger" };
    }
    if (/special|restructure|sma/.test(status)) {
        return { label: "Fair", tone: "warn" };
    }
    return { label: "Excellent", tone: "excellent" };
};

const factorMetaFromText = (description, basePct) => {
    const text = String(description || "").toLowerCase();
    let pct = basePct;
    let label =
        basePct >= 90
            ? "Excellent"
            : basePct >= 80
              ? "Very Good"
              : basePct >= 70
                ? "Good"
                : basePct >= 50
                  ? "Fair"
                  : "Needs Work";

    if (
        /delinquen|overdue|past due|high utilization|too many|serious|default|write.?off/.test(
            text
        )
    ) {
        pct = Math.min(pct, 45);
        label = "Needs Work";
    } else if (/thin|short|limited|recent|new account/.test(text)) {
        pct = Math.min(pct, 62);
        label = "Fair";
    } else if (/excellent|strong|low utilization|on.?time|positive/.test(text)) {
        pct = Math.max(pct, 88);
        label = "Excellent";
    }

    return { pct: Math.round(pct), label };
};

const factorTitle = (description, index) => {
    const defaults = [
        "Payment History",
        "Credit Utilization",
        "Credit Age",
        "Credit Mix",
        "Recent Enquiries",
        "Account Standing",
    ];
    const text = String(description || "");
    if (/payment|history|due|delinquen/i.test(text)) return "Payment History";
    if (/utiliz|balance|limit|exposure/i.test(text)) return "Credit Utilization";
    if (/age|length|vintage|oldest/i.test(text)) return "Credit Age";
    if (/mix|divers|type of credit|variety/i.test(text)) return "Credit Mix";
    if (/enquir|inquiry|search/i.test(text)) return "Recent Enquiries";
    if (text.length && text.length < 40) return text;
    return defaults[index] || `Factor ${index + 1}`;
};

const isCardAccount = (type) =>
    /card|credit card|cc|plastic/i.test(String(type || ""));

const isLoanAccount = (type) =>
    /loan|emi|auto|home|housing|personal|property|overdraft|od|gold|education|consumer/i.test(
        String(type || "")
    );

const extractReport = (raw) => {
    const list =
        raw?.data?.cCRResponse?.cIRReportDataLst ||
        raw?.data?.CCRResponse?.CIRReportDataLst ||
        raw?.cCRResponse?.cIRReportDataLst;
    if (!Array.isArray(list) || !list.length) return null;
    return list[0]?.cIRReportData || list[0]?.CIRReportData || null;
};

const mapPersonal = (contact, fallback = {}) => {
    const personal = contact?.personalInfo || contact?.PersonalInfo || {};
    const nameObj = personal.name || personal.Name || {};
    const fullName =
        pick(nameObj, ["fullName", "FullName"]) ||
        [
            pick(nameObj, ["firstName", "FirstName"]),
            pick(nameObj, ["lastName", "LastName"]),
        ]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        fallback.name ||
        null;

    const panList = asArray(
        contact?.identityInfo?.pANId ||
            contact?.identityInfo?.PANId ||
            contact?.IdentityInfo?.PANId
    );
    const pan =
        pick(panList[0] || {}, ["idNumber", "IdNumber"]) ||
        fallback.pan ||
        null;

    const phones = asArray(contact?.phoneInfo || contact?.PhoneInfo)
        .map((p) => ({
            number: str(pick(p, ["number", "Number"]), ""),
            type: str(pick(p, ["typeCode", "TypeCode", "type", "Type"]), ""),
            reportedDate: str(pick(p, ["reportedDate", "ReportedDate"]), ""),
        }))
        .filter((p) => p.number);

    const addresses = asArray(contact?.addressInfo || contact?.AddressInfo)
        .map((a) => ({
            address: str(pick(a, ["address", "Address"]), ""),
            state: str(pick(a, ["state", "State"]), ""),
            postal: str(
                pick(a, ["postal", "Postal", "pincode", "Pincode"]),
                ""
            ),
            type: str(pick(a, ["type", "Type"]), ""),
            reportedDate: str(pick(a, ["reportedDate", "ReportedDate"]), ""),
        }))
        .filter((a) => a.address);

    const emails = asArray(
        contact?.emailAddressInfo || contact?.EmailAddressInfo
    )
        .map((e) => str(pick(e, ["emailAddress", "EmailAddress"]), ""))
        .filter(Boolean);

    return {
        fullName: str(fullName, fallback.name || "—"),
        dateOfBirth: str(pick(personal, ["dateOfBirth", "DateOfBirth"]), "—"),
        gender: str(pick(personal, ["gender", "Gender"]), "—"),
        age: str(
            pick(personal.age || personal.Age || {}, ["age", "Age"]) ||
                pick(personal, ["age", "Age"]),
            "—"
        ),
        occupation: str(pick(personal, ["occupation", "Occupation"]), "—"),
        pan: pan ? String(pan).toUpperCase() : "—",
        phones,
        addresses,
        emails,
        mobile: fallback.mobile || phones[0]?.number || "—",
    };
};

const mapScore = (report) => {
    const details = asArray(report?.scoreDetails || report?.ScoreDetails);
    const entry = details[0] || {};
    const value = numOrNull(pick(entry, ["value", "Value"]));
    const name =
        pick(entry, ["name", "Name"]) ||
        [pick(entry, ["type", "Type"]), pick(entry, ["version", "Version"])]
            .filter(Boolean)
            .join("") ||
        null;

    const band = scoreBand(value);
    const rawFactors = asArray(
        entry.scoringElements || entry.ScoringElements
    )
        .map((f) => ({
            code: str(pick(f, ["code", "Code"]), ""),
            description: str(pick(f, ["description", "Description"]), ""),
        }))
        .filter((f) => f.description)
        .slice(0, 6);

    const factors = (
        rawFactors.length
            ? rawFactors
            : [
                  { description: "Payment History" },
                  { description: "Credit Utilization" },
                  { description: "Credit Age" },
                  { description: "Credit Mix" },
              ]
    )
        .map((f, index) => {
            const meta = factorMetaFromText(f.description, band.pct || 70);
            return {
                code: f.code || "",
                description: f.description,
                title: factorTitle(f.description, index),
                pct: meta.pct,
                label: meta.label,
            };
        })
        .filter((f, i, arr) => {
            // Bureau often repeats the same utilization factor
            const key = String(f.title || f.description || "")
                .trim()
                .toLowerCase();
            return (
                key &&
                arr.findIndex(
                    (x) =>
                        String(x.title || x.description || "")
                            .trim()
                            .toLowerCase() === key
                ) === i
            );
        })
        .slice(0, 4);

    return {
        value,
        name: str(name, "Credit Score"),
        bandLabel: band.label,
        bandTone: band.tone,
        bandPct: band.pct,
        factors,
        trend:
            value != null && value >= 0 ? [{ label: "Now", value }] : [],
    };
};

const mapSummary = (report) => {
    const s =
        report?.retailAccountsSummary || report?.RetailAccountsSummary || {};
    if (!s || !Object.keys(s).length) return null;

    const balanceRaw = numOrNull(
        pick(s, ["totalBalanceAmount", "TotalBalanceAmount"])
    );
    const limitRaw = numOrNull(
        pick(s, ["totalCreditLimit", "TotalCreditLimit"])
    );
    const sanctionRaw = numOrNull(
        pick(s, ["totalSanctionAmount", "TotalSanctionAmount"])
    );

    return {
        noOfAccounts: str(pick(s, ["noOfAccounts", "NoOfAccounts"])),
        noOfActiveAccounts: str(
            pick(s, ["noOfActiveAccounts", "NoOfActiveAccounts"])
        ),
        noOfWriteOffs: str(pick(s, ["noOfWriteOffs", "NoOfWriteOffs"])),
        noOfPastDueAccounts: str(
            pick(s, ["noOfPastDueAccounts", "NoOfPastDueAccounts"])
        ),
        totalBalanceAmount: formatAmount(balanceRaw),
        totalSanctionAmount: formatAmount(sanctionRaw),
        totalCreditLimit: formatAmount(limitRaw),
        totalPastDue: formatAmount(pick(s, ["totalPastDue", "TotalPastDue"])),
        totalMonthlyPaymentAmount: formatAmount(
            pick(s, [
                "totalMonthlyPaymentAmount",
                "TotalMonthlyPaymentAmount",
            ])
        ),
        singleHighestCredit: formatAmount(
            pick(s, ["singleHighestCredit", "SingleHighestCredit"])
        ),
        oldestAccount: str(pick(s, ["oldestAccount", "OldestAccount"])),
        recentAccount: str(pick(s, ["recentAccount", "RecentAccount"])),
        mostSevereStatus: str(
            pick(s, [
                "mostSevereStatusWithIn24Months",
                "MostSevereStatusWithIn24Months",
            ])
        ),
        balanceRaw,
        limitRaw,
        sanctionRaw,
    };
};

const mapAccounts = (report) => {
    const list = asArray(
        report?.retailAccountDetails ||
            report?.RetailAccountDetails ||
            report?.retailAccountsDetails
    );

    return list
        .map((a) => {
            const balanceRaw = numOrNull(
                pick(a, [
                    "balance",
                    "Balance",
                    "currentBalance",
                    "CurrentBalance",
                    "balanceAmount",
                ])
            );
            const limitRaw = numOrNull(
                pick(a, [
                    "creditLimit",
                    "CreditLimit",
                    "sanctionAmount",
                    "SanctionAmount",
                    "highCreditAmount",
                    "HighCreditAmount",
                ])
            );
            const pastDueRaw = numOrNull(
                pick(a, [
                    "pastDueAmount",
                    "PastDueAmount",
                    "amountPastDue",
                    "overdueAmount",
                ])
            );
            const status = str(
                pick(a, [
                    "accountStatus",
                    "AccountStatus",
                    "open",
                    "Open",
                    "status",
                    "Status",
                ])
            );
            const active = isActiveStatus(status);
            const usedPct =
                balanceRaw != null && limitRaw != null && limitRaw > 0
                    ? Math.min(
                          100,
                          Math.max(0, Math.round((balanceRaw / limitRaw) * 100))
                      )
                    : null;

            const row = {
                institution: str(
                    pick(a, [
                        "institution",
                        "Institution",
                        "institutionName",
                        "InstitutionName",
                    ])
                ),
                accountType: str(
                    pick(a, ["accountType", "AccountType", "accountTypeCode"])
                ),
                accountNumber: str(
                    pick(a, [
                        "accountNumber",
                        "AccountNumber",
                        "maskedAccountNumber",
                    ])
                ),
                status,
                active,
                ownership: str(
                    pick(a, ["ownershipType", "OwnershipType", "ownership"])
                ),
                dateOpened: str(
                    pick(a, [
                        "dateOpened",
                        "DateOpened",
                        "dateReported",
                        "DateReported",
                        "openDate",
                    ])
                ),
                dateClosed: str(
                    pick(a, [
                        "dateClosed",
                        "DateClosed",
                        "closedDate",
                        "ClosedDate",
                    ]),
                    ""
                ),
                balance: formatAmount(balanceRaw),
                pastDue: formatAmount(pastDueRaw),
                sanction: formatAmount(limitRaw),
                balanceRaw,
                limitRaw,
                pastDueRaw,
                usedPct,
            };
            row.behaviour = behaviourFromAccount(row);
            return row;
        })
        .filter(
            (a) =>
                a.institution !== "—" ||
                a.accountType !== "—" ||
                a.accountNumber !== "—"
        );
};

const mapEnquirySummary = (report) => {
    const e =
        report?.enquirySummary ||
        report?.EnquirySummary ||
        report?.enquiriesSummary;
    if (!e || typeof e !== "object") return null;
    return {
        total: str(pick(e, ["total", "Total"])),
        past30Days: str(pick(e, ["past30Days", "Past30Days"])),
        past12Months: str(pick(e, ["past12Months", "Past12Months"])),
        past24Months: str(pick(e, ["past24Months", "Past24Months"])),
        recent: str(pick(e, ["recent", "Recent"])),
        purpose: str(pick(e, ["purpose", "Purpose"])),
    };
};

const mapEnquiries = (report) => {
    const list = asArray(
        report?.enquiries ||
            report?.Enquiries ||
            report?.enquiryDetails ||
            report?.EnquiryDetails
    );
    return list
        .map((e) => {
            const purpose = str(
                pick(e, [
                    "requestPurpose",
                    "RequestPurpose",
                    "purpose",
                    "Purpose",
                    "enquiryPurpose",
                ])
            );
            const impactRaw = str(
                pick(e, [
                    "enquiryType",
                    "EnquiryType",
                    "impact",
                    "Impact",
                    "type",
                    "Type",
                ]),
                ""
            );
            let impact = "Hard";
            if (/soft/i.test(impactRaw) || /soft/i.test(purpose)) {
                impact = "Soft";
            }
            return {
                institution: str(
                    pick(e, ["institution", "Institution", "memberName"])
                ),
                date: str(
                    pick(e, ["date", "Date", "enquiryDate", "EnquiryDate"])
                ),
                purpose,
                impact,
            };
        })
        .filter((e) => e.institution !== "—" || e.date !== "—")
        .slice(0, 25);
};

const mapRecentActivities = (report) => {
    const r = report?.recentActivities || report?.RecentActivities;
    if (!r || typeof r !== "object") return null;
    return {
        accountsDelinquent: str(
            pick(r, [
                "accountsDeliquent",
                "accountsDelinquent",
                "AccountsDeliquent",
            ])
        ),
        accountsOpened: str(pick(r, ["accountsOpened", "AccountsOpened"])),
        totalInquiries: str(pick(r, ["totalInquiries", "TotalInquiries"])),
        accountsUpdated: str(pick(r, ["accountsUpdated", "AccountsUpdated"])),
    };
};

const buildUtilization = (summary, accounts) => {
    let used = summary?.balanceRaw;
    let limit = summary?.limitRaw;

    if ((used == null || limit == null || limit <= 0) && accounts?.length) {
        used = accounts.reduce(
            (sum, a) => sum + (Number(a.balanceRaw) || 0),
            0
        );
        limit = accounts.reduce(
            (sum, a) => sum + (Number(a.limitRaw) || 0),
            0
        );
    }

    if (limit == null || limit <= 0) {
        return null;
    }

    const usedSafe = Math.max(0, Number(used) || 0);
    const available = Math.max(0, limit - usedSafe);
    const usedPct = Math.min(
        100,
        Math.max(0, Math.round((usedSafe / limit) * 100))
    );

    let tip =
        "Keep utilization under 30% to maintain a healthy credit score.";
    let tipTone = "ok";
    if (usedPct <= 20) {
        tip = "Great! You're keeping credit utilization low.";
        tipTone = "excellent";
    } else if (usedPct <= 30) {
        tip = "Good utilization. Try to stay under 30% for best scores.";
        tipTone = "good";
    } else if (usedPct <= 50) {
        tip = "Utilization is elevated. Pay down balances for a score boost.";
        tipTone = "warn";
    } else {
        tip =
            "High utilization is likely hurting your score. Reduce balances.";
        tipTone = "danger";
    }

    return {
        usedPct,
        usedAmount: formatAmount(usedSafe),
        availableAmount: formatAmount(available),
        totalLimit: formatAmount(limit),
        usedRaw: usedSafe,
        availableRaw: available,
        limitRaw: limit,
        tip,
        tipTone,
    };
};

const buildPaymentSummary = (summary, accounts, recentActivities) => {
    const active = accounts.filter((a) => a.active);
    const pastDueAccounts =
        numOrNull(summary?.noOfPastDueAccounts) ??
        accounts.filter((a) => (a.pastDueRaw || 0) > 0).length;
    const total = Math.max(accounts.length, 1);
    const clean = Math.max(0, total - Number(pastDueAccounts || 0));
    const onTimePct = Math.round((clean / total) * 100);

    const cards = accounts.filter((a) => isCardAccount(a.accountType)).length;
    const loans = accounts.filter((a) => isLoanAccount(a.accountType)).length;

    return {
        onTimePct,
        missedPayments:
            numOrNull(recentActivities?.accountsDelinquent) ??
            Number(pastDueAccounts || 0),
        activeAccounts:
            numOrNull(summary?.noOfActiveAccounts) ?? active.length,
        oldestAccount: summary?.oldestAccount || "—",
        creditCards: cards,
        loans: loans || Math.max(0, accounts.length - cards),
    };
};

const buildSummaryText = (model) => {
    const score = model.score?.value;
    const band = model.score?.bandLabel || "N/A";
    const util = model.utilization?.usedPct;
    const active =
        model.paymentSummary?.activeAccounts ??
        model.summary?.noOfActiveAccounts ??
        "—";
    const parts = [
        `Your Equifax credit profile is rated ${band}` +
            (score != null && score >= 0 ? ` with a score of ${score}` : "") +
            ".",
    ];
    if (util != null) {
        parts.push(
            `Overall credit utilization stands at ${util}% across reported limits.`
        );
    }
    parts.push(
        `You currently have ${active} active account(s) on file with the bureau.`
    );
    if (model.enquirySummary?.past30Days) {
        parts.push(
            `${model.enquirySummary.past30Days} enquir${
                String(model.enquirySummary.past30Days) === "1" ? "y" : "ies"
            } reported in the last 30 days.`
        );
    }
    return parts.join(" ");
};

/**
 * @param {object} raw - Decentro rawResponse
 * @param {object} meta - { referenceId, mobile, email, name, pan, generatedAt, previousReports }
 */
exports.mapCreditReportForPdf = (raw, meta = {}) => {
    const report = extractReport(raw);
    if (!report) {
        return null;
    }

    const contact = report.iDAndContactInfo || report.IDAndContactInfo || {};
    const personal = mapPersonal(contact, {
        name: meta.name,
        pan: meta.pan,
        mobile: meta.mobile,
    });
    const score = mapScore(report);
    const summary = mapSummary(report);
    const accounts = mapAccounts(report);
    const enquirySummary = mapEnquirySummary(report);
    const enquiries = mapEnquiries(report);
    const recentActivities = mapRecentActivities(report);
    const utilization = buildUtilization(summary, accounts);
    const paymentSummary = buildPaymentSummary(
        summary,
        accounts,
        recentActivities
    );

    const model = {
        meta: {
            referenceId: str(meta.referenceId, "—"),
            email: str(meta.email, "—"),
            generatedAt: meta.generatedAt
                ? new Date(meta.generatedAt)
                : new Date(),
            provider: "Equifax",
            decentroTxnId: str(
                raw?.decentroTxnId || meta.decentroTxnId,
                "—"
            ),
            brand: "MyCredAxis",
        },
        personal,
        score,
        summary,
        accounts,
        activeAccounts: accounts.filter((a) => a.active),
        closedAccounts: accounts.filter((a) => !a.active),
        enquirySummary,
        enquiries,
        recentActivities,
        utilization,
        paymentSummary,
        previousReports: Array.isArray(meta.previousReports)
            ? meta.previousReports
            : [],
    };

    model.overviewText = buildSummaryText(model);
    return model;
};

exports.scoreBand = scoreBand;
exports.formatAmount = formatAmount;
exports.numOrNull = numOrNull;
