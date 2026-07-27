/**
 * Normalize Equifax CIR rawResponse into a stable view-model for PDF rendering.
 * Tolerant of missing sections and mixed casing.
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
        return { label: "No History", tone: "muted" };
    }
    if (score < 550) return { label: "Poor", tone: "danger" };
    if (score < 650) return { label: "Fair", tone: "warn" };
    if (score < 750) return { label: "Good", tone: "ok" };
    if (score < 800) return { label: "Very Good", tone: "good" };
    return { label: "Excellent", tone: "excellent" };
};

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
        [pick(nameObj, ["firstName", "FirstName"]), pick(nameObj, ["lastName", "LastName"])]
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

    const phones = asArray(contact?.phoneInfo || contact?.PhoneInfo).map(
        (p) => ({
            number: str(pick(p, ["number", "Number"]), ""),
            type: str(pick(p, ["typeCode", "TypeCode", "type", "Type"]), ""),
            reportedDate: str(
                pick(p, ["reportedDate", "ReportedDate"]),
                ""
            ),
        })
    ).filter((p) => p.number);

    const addresses = asArray(
        contact?.addressInfo || contact?.AddressInfo
    ).map((a) => ({
        address: str(pick(a, ["address", "Address"]), ""),
        state: str(pick(a, ["state", "State"]), ""),
        postal: str(pick(a, ["postal", "Postal", "pincode", "Pincode"]), ""),
        type: str(pick(a, ["type", "Type"]), ""),
        reportedDate: str(pick(a, ["reportedDate", "ReportedDate"]), ""),
    })).filter((a) => a.address);

    const emails = asArray(
        contact?.emailAddressInfo || contact?.EmailAddressInfo
    )
        .map((e) => str(pick(e, ["emailAddress", "EmailAddress"]), ""))
        .filter(Boolean);

    return {
        fullName: str(fullName, fallback.name || "—"),
        dateOfBirth: str(
            pick(personal, ["dateOfBirth", "DateOfBirth"]),
            "—"
        ),
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
    const details = asArray(
        report?.scoreDetails || report?.ScoreDetails
    );
    const entry = details[0] || {};
    const value = numOrNull(pick(entry, ["value", "Value"]));
    const name =
        pick(entry, ["name", "Name"]) ||
        [
            pick(entry, ["type", "Type"]),
            pick(entry, ["version", "Version"]),
        ]
            .filter(Boolean)
            .join("") ||
        null;

    const factors = asArray(
        entry.scoringElements || entry.ScoringElements
    )
        .map((f) => ({
            code: str(pick(f, ["code", "Code"]), ""),
            description: str(
                pick(f, ["description", "Description"]),
                ""
            ),
        }))
        .filter((f) => f.description)
        .slice(0, 6);

    const band = scoreBand(value);
    return {
        value,
        name: str(name, "Credit Score"),
        bandLabel: band.label,
        bandTone: band.tone,
        factors,
    };
};

const mapSummary = (report) => {
    const s =
        report?.retailAccountsSummary ||
        report?.RetailAccountsSummary ||
        {};
    if (!s || !Object.keys(s).length) return null;

    return {
        noOfAccounts: str(pick(s, ["noOfAccounts", "NoOfAccounts"])),
        noOfActiveAccounts: str(
            pick(s, ["noOfActiveAccounts", "NoOfActiveAccounts"])
        ),
        noOfWriteOffs: str(pick(s, ["noOfWriteOffs", "NoOfWriteOffs"])),
        noOfPastDueAccounts: str(
            pick(s, ["noOfPastDueAccounts", "NoOfPastDueAccounts"])
        ),
        totalBalanceAmount: formatAmount(
            pick(s, ["totalBalanceAmount", "TotalBalanceAmount"])
        ),
        totalSanctionAmount: formatAmount(
            pick(s, ["totalSanctionAmount", "TotalSanctionAmount"])
        ),
        totalCreditLimit: formatAmount(
            pick(s, ["totalCreditLimit", "TotalCreditLimit"])
        ),
        totalPastDue: formatAmount(
            pick(s, ["totalPastDue", "TotalPastDue"])
        ),
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
    };
};

const mapAccounts = (report) => {
    const list = asArray(
        report?.retailAccountDetails ||
            report?.RetailAccountDetails ||
            report?.retailAccountsDetails
    );

    return list
        .map((a) => ({
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
            status: str(
                pick(a, [
                    "accountStatus",
                    "AccountStatus",
                    "open",
                    "Open",
                    "status",
                    "Status",
                ])
            ),
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
            balance: formatAmount(
                pick(a, [
                    "balance",
                    "Balance",
                    "currentBalance",
                    "CurrentBalance",
                    "balanceAmount",
                ])
            ),
            pastDue: formatAmount(
                pick(a, [
                    "pastDueAmount",
                    "PastDueAmount",
                    "amountPastDue",
                    "overdueAmount",
                ])
            ),
            sanction: formatAmount(
                pick(a, [
                    "sanctionAmount",
                    "SanctionAmount",
                    "highCreditAmount",
                    "HighCreditAmount",
                    "creditLimit",
                    "CreditLimit",
                ])
            ),
        }))
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
        .map((e) => ({
            institution: str(
                pick(e, ["institution", "Institution", "memberName"])
            ),
            date: str(pick(e, ["date", "Date", "enquiryDate", "EnquiryDate"])),
            purpose: str(
                pick(e, [
                    "requestPurpose",
                    "RequestPurpose",
                    "purpose",
                    "Purpose",
                    "enquiryPurpose",
                ])
            ),
        }))
        .filter((e) => e.institution !== "—" || e.date !== "—")
        .slice(0, 25);
};

const mapRecentActivities = (report) => {
    const r = report?.recentActivities || report?.RecentActivities;
    if (!r || typeof r !== "object") return null;
    return {
        accountsDelinquent: str(
            pick(r, ["accountsDeliquent", "accountsDelinquent", "AccountsDeliquent"])
        ),
        accountsOpened: str(pick(r, ["accountsOpened", "AccountsOpened"])),
        totalInquiries: str(pick(r, ["totalInquiries", "TotalInquiries"])),
        accountsUpdated: str(pick(r, ["accountsUpdated", "AccountsUpdated"])),
    };
};

/**
 * @param {object} raw - Decentro rawResponse
 * @param {object} meta - { referenceId, inquiryPurpose, mobile, name, pan, generatedAt }
 */
exports.mapCreditReportForPdf = (raw, meta = {}) => {
    const report = extractReport(raw);
    if (!report) {
        return null;
    }

    const contact =
        report.iDAndContactInfo || report.IDAndContactInfo || {};
    const personal = mapPersonal(contact, {
        name: meta.name,
        pan: meta.pan,
        mobile: meta.mobile,
    });

    return {
        meta: {
            referenceId: str(meta.referenceId, "—"),
            inquiryPurpose: str(meta.inquiryPurpose, "—"),
            generatedAt: meta.generatedAt
                ? new Date(meta.generatedAt)
                : new Date(),
            provider: "Equifax",
            decentroTxnId: str(
                raw?.decentroTxnId || meta.decentroTxnId,
                "—"
            ),
        },
        personal,
        score: mapScore(report),
        summary: mapSummary(report),
        accounts: mapAccounts(report),
        enquirySummary: mapEnquirySummary(report),
        enquiries: mapEnquiries(report),
        recentActivities: mapRecentActivities(report),
    };
};

exports.scoreBand = scoreBand;
exports.formatAmount = formatAmount;
