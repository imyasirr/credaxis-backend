const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");

const decentroClient = require("../../../integrations/decentro/decentro.client");
const creditReportRepository = require("./repository");
const userRepository = require("../user/repository");
const UserProfile = require("../user/profile.model");
const Kyc = require("../kyc/model");

const ApiError = require("../../../utils/ApiError");
const {
    getUploadPath,
    deleteUploadFile,
} = require("../../../middleware/upload.middleware");
const { formatCreditReport } = require("./mapper");
const { buildAndSaveCredAxisPdf } = require("./pdf.builder");
const notificationService = require("../notification/service");

const CREDIT_REPORT_PATH =
    process.env.DECENTRO_CREDIT_REPORT_PATH ||
    "/v2/financial_services/credit_bureau/credit_report/summary";

const VALID_INQUIRY_PURPOSES = ["BL", "CC", "CL", "HL", "GL", "PL"];
/** Fixed bureau inquiry purpose — not collected from clients */
const DEFAULT_INQUIRY_PURPOSE = "PL";

const CONSENT_PURPOSE_DEFAULT =
    "To fetch Equifax credit report on CredAxis";

const loadPreviousReportsForPdf = async (userId, excludeReferenceId = null) => {
    if (!userId) return [];
    try {
        const items = await creditReportRepository.findByUserId(userId, {
            limit: 8,
        });
        return (items || [])
            .filter(
                (r) =>
                    r.status === "SUCCESS" &&
                    r.score != null &&
                    String(r.referenceId) !== String(excludeReferenceId || "")
            )
            .slice(0, 5)
            .map((r) => ({
                score: r.score,
                date: formatDateSafe(r.createdAt || r.updatedAt),
                referenceId: r.referenceId,
            }));
    } catch {
        return [];
    }
};

const formatDateSafe = (date) => {
    try {
        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
        }).format(date instanceof Date ? date : new Date(date));
    } catch {
        return "—";
    }
};

const ensureCreditReportDir = () => {
    const { getUploadDir } = require("../../../middleware/upload.middleware");
    return getUploadDir("credit-reports");
};

/**
 * Safe filename segment from person's name (filesystem-friendly).
 */
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

/**
 * Decode base64 PDF from Decentro response and save to disk.
 * Filename uses the checked person's name (not user id).
 * Returns public relative path or null.
 */
const savePdfFromResponse = (raw, personName, referenceId) => {
    if (!raw || typeof raw !== "object") return null;

    const candidates = [
        raw.pdf,
        raw.pdfBase64,
        raw.base64Pdf,
        raw.creditReportPdf,
        raw.data?.pdf,
        raw.data?.pdfBase64,
        raw.data?.base64Pdf,
        raw.data?.creditReportPdf,
        raw.data?.pdf_report,
        raw.data?.reportPdf,
    ];

    let base64 = candidates.find(
        (v) => typeof v === "string" && v.trim().length > 100
    );

    if (!base64) return null;

    // Strip data-uri prefix if present
    base64 = base64.replace(/^data:application\/pdf;base64,/, "").trim();

    try {
        const buffer = Buffer.from(base64, "base64");
        if (buffer.length < 100) return null;

        const dir = ensureCreditReportDir();
        const namePart = slugifyName(personName);
        // Short unique suffix so same-name rechecks don't overwrite
        const unique =
            String(referenceId || "")
                .replace(/[^a-zA-Z0-9]/g, "")
                .slice(-10) || String(Date.now()).slice(-8);
        const filename = `${namePart}_${unique}.pdf`;
        fs.writeFileSync(path.join(dir, filename), buffer);
        return getUploadPath("credit-reports", filename);
    } catch {
        return null;
    }
};

const extractReportBlock = (raw) => {
    const list = raw?.data?.cCRResponse?.cIRReportDataLst;
    if (!Array.isArray(list) || !list.length) return null;
    return list[0];
};

const extractIndexedFields = (raw, fallback = {}) => {
    const block = extractReportBlock(raw);
    const report = block?.cIRReportData;

    if (block?.error) {
        return {
            status: "NOT_FOUND",
            name: fallback.name || null,
            pan: fallback.pan || null,
            score: null,
            scoreName: null,
            errorCode: block.error.errorCode || null,
            errorMessage: block.error.errorDesc || "Consumer not found in bureau",
        };
    }

    if (!report) {
        return {
            status: "FAILED",
            name: fallback.name || null,
            pan: fallback.pan || null,
            score: null,
            scoreName: null,
            errorCode: null,
            errorMessage: "No credit report data in response",
        };
    }

    const personal = report.iDAndContactInfo?.personalInfo;
    const fullName =
        personal?.name?.fullName?.trim() ||
        [personal?.name?.firstName, personal?.name?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        fallback.name ||
        null;

    const pan =
        report.iDAndContactInfo?.identityInfo?.pANId?.[0]?.idNumber
            ?.trim()
            ?.toUpperCase() ||
        fallback.pan ||
        null;

    const scoreEntry = Array.isArray(report.scoreDetails)
        ? report.scoreDetails[0]
        : null;

    const scoreRaw = scoreEntry?.value;
    const score =
        scoreRaw != null && scoreRaw !== "" && !Number.isNaN(Number(scoreRaw))
            ? Number(scoreRaw)
            : null;

    return {
        status: "SUCCESS",
        name: fullName,
        pan,
        score,
        scoreName: scoreEntry?.name || scoreEntry?.type || null,
        errorCode: null,
        errorMessage: null,
    };
};

const buildReferenceId = () =>
    `CX-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 12)}`;

const normalizePersonName = (name) =>
    String(name || "")
        .trim()
        .replace(/\s+/g, " ");

/**
 * Reusable Decentro Equifax credit report fetch.
 * Client fields: name, email, pan, mobile only.
 * Same checklist user + PAN + mobile + provider updates that bureau's doc only —
 * another bureau's report for the same person is never overwritten.
 */
exports.fetchCreditReportSummary = async ({
    userId = null,
    checkedBy = null,
    source = "USER",
    subjectType = "SELF",
    provider = "EQUIFAX",
    name,
    mobile,
    email = null,
    pan = null,
    consent = true,
    consentPurpose = CONSENT_PURPOSE_DEFAULT,
    generatePdf = true,
    referenceId,
}) => {
    if (!consent) {
        throw new ApiError(400, "Consent must be true to fetch credit report");
    }

    const cleanName = normalizePersonName(name);
    const cleanMobile = String(mobile || "").trim();
    const cleanEmail = String(email || "")
        .trim()
        .toLowerCase();
    const cleanPan = String(pan || "")
        .trim()
        .toUpperCase();
    const cleanProvider = String(provider || "EQUIFAX")
        .trim()
        .toUpperCase();

    if (!cleanName || cleanName.length < 2) {
        throw new ApiError(400, "Name is required (2-40 characters)");
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
        throw new ApiError(400, "Valid 10-digit mobile is required");
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new ApiError(400, "Valid email is required");
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanPan)) {
        throw new ApiError(400, "Valid PAN is required");
    }

    const existingSubject =
        await creditReportRepository.findBySubjectIdentity({
            pan: cleanPan,
            mobile: cleanMobile,
            name: cleanName,
            userId: userId || null,
            provider: cleanProvider,
        });

    const refId = referenceId || buildReferenceId();

    const existingRef = await creditReportRepository.findByReferenceId(refId);
    if (
        existingRef &&
        (!existingSubject ||
            String(existingRef._id) !== String(existingSubject._id))
    ) {
        throw new ApiError(400, "Duplicate reference_id");
    }

    const purpose = DEFAULT_INQUIRY_PURPOSE;

    // What we send to Decentro (inquiry_purpose fixed server-side)
    const decentroPayload = {
        reference_id: refId,
        consent: true,
        consent_purpose:
            String(consentPurpose || "").length >= 20
                ? consentPurpose
                : CONSENT_PURPOSE_DEFAULT,
        name: cleanName.slice(0, 40),
        mobile: cleanMobile,
        inquiry_purpose: purpose,
        document_type: "PAN",
        document_id: cleanPan,
        generate_pdf: Boolean(generatePdf),
    };

    // Stored audit — only client-facing fields (no DOB/address/pin/inquiry)
    const requestPayload = {
        reference_id: refId,
        name: cleanName,
        mobile: cleanMobile,
        email: cleanEmail,
        pan: cleanPan,
        consent: true,
    };

    const resolvedSource = source === "ADMIN" ? "ADMIN" : "USER";
    const resolvedSubjectType =
        subjectType === "OTHER" ? "OTHER" : "SELF";

    let record = existingSubject;
    if (record) {
        if (record.pdfPath) {
            deleteUploadFile(record.pdfPath);
        }
        record.checkedBy = checkedBy || record.checkedBy || null;
        if (userId) {
            record.user = userId;
        }
        // Keep SELF if this was already the owner's own report
        if (!(record.subjectType === "SELF" && resolvedSubjectType === "OTHER")) {
            record.subjectType = resolvedSubjectType;
        }
        if (resolvedSource === "ADMIN" || !record.source) {
            record.source = resolvedSource;
        }
        record.referenceId = refId;
        record.provider = cleanProvider;
        record.status = "PENDING";
        record.name = cleanName;
        record.mobile = cleanMobile;
        record.email = cleanEmail;
        record.pan = cleanPan;
        record.requestPayload = requestPayload;
        record.score = null;
        record.scoreName = null;
        record.decentroTxnId = null;
        record.responseKey = null;
        record.message = null;
        record.pdfPath = null;
        record.rawResponse = null;
        record.errorCode = null;
        record.errorMessage = null;
        await record.save();
    } else {
        record = await creditReportRepository.create({
            user: userId || null,
            checkedBy: checkedBy || null,
            source: resolvedSource,
            subjectType: resolvedSubjectType,
            referenceId: refId,
            provider: cleanProvider,
            status: "PENDING",
            name: cleanName,
            mobile: cleanMobile,
            email: cleanEmail,
            pan: cleanPan,
            requestPayload,
        });
    }

    const { statusCode, data: raw } = await decentroClient.post(
        CREDIT_REPORT_PATH,
        decentroPayload
    );

    const decentroStatus = String(raw?.status || "").toUpperCase();
    const isHttpOk = statusCode >= 200 && statusCode < 300;
    const isApiSuccess = decentroStatus === "SUCCESS";

    let pdfPath = null;
    let extracted;

    if (isHttpOk && isApiSuccess) {
        extracted = extractIndexedFields(raw, {
            name: cleanName,
            pan: cleanPan,
        });
        const pdfName = extracted.name || cleanName;
        const previousReports = await loadPreviousReportsForPdf(
            userId || null,
            refId
        );
        try {
            pdfPath = await buildAndSaveCredAxisPdf(raw, {
                referenceId: refId,
                name: pdfName,
                pan: extracted.pan || cleanPan,
                mobile: cleanMobile,
                email: cleanEmail,
                decentroTxnId: raw?.decentroTxnId,
                generatedAt: new Date(),
                previousReports,
            });
        } catch (err) {
            console.error("CredAxis PDF build failed:", err.message);
            pdfPath = null;
        }
        if (!pdfPath) {
            pdfPath = savePdfFromResponse(raw, pdfName, refId);
        }
    } else {
        extracted = {
            status: "FAILED",
            name: cleanName,
            pan: cleanPan,
            score: null,
            scoreName: null,
            errorCode: raw?.responseCode || String(statusCode),
            errorMessage:
                raw?.message ||
                raw?.responseKey ||
                "Credit report request failed",
        };
    }

    record.status = extracted.status;
    record.name = extracted.name;
    record.pan = extracted.pan || cleanPan;
    record.email = cleanEmail;
    record.score = extracted.score;
    record.scoreName = extracted.scoreName;
    record.decentroTxnId = raw?.decentroTxnId || null;
    record.responseKey = raw?.responseKey || null;
    record.message = raw?.message || extracted.errorMessage;
    record.pdfPath = pdfPath;
    record.rawResponse = raw;
    record.errorCode = extracted.errorCode;
    record.errorMessage = extracted.errorMessage;
    await record.save();

    if (extracted.status === "FAILED") {
        await notificationService.notifySafe(userId, {
            title: "Credit report failed",
            message:
                extracted.errorMessage ||
                "We could not fetch the credit report. Please try again.",
            type: "ERROR",
        });

        throw new ApiError(
            statusCode >= 400 && statusCode < 500 ? statusCode : 502,
            extracted.errorMessage || "Credit report fetch failed"
        );
    }

    await notificationService.notifySafe(userId, {
        title:
            source === "ADMIN"
                ? "Credit report ready"
                : "Credit report fetched",
        message:
            extracted.score != null
                ? `Credit report ready for ${cleanName}. Score: ${extracted.score}`
                : `Credit report ready for ${cleanName}`,
        type: "SUCCESS",
    });

    const formatted = formatCreditReport(record, { includeRaw: true });
    formatted.updated = Boolean(existingSubject);
    return formatted;
};

/**
 * Prefill name / mobile / email / PAN from profile + KYC when possible.
 */
exports.fetchForUser = async (userId, body = {}) => {
    const user = await userRepository.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const paymentService = require("../payments/service");
    const paymentId = body.paymentId || body.payment_id;
    let claimedPayment = null;

    try {
        claimedPayment = await paymentService.consumeCreditCheckPayment(
            userId,
            paymentId
        );

        const forSelf = body.forSelf !== false;
        const mobile = String(body.mobile || body.phone || "").trim();

        let report;

        if (!forSelf) {
            report = await exports.fetchCreditReportSummary({
                userId,
                source: "USER",
                subjectType: "OTHER",
                name: body.name?.trim(),
                mobile,
                email: body.email?.trim(),
                pan: body.pan?.trim()?.toUpperCase(),
                consent: body.consent !== false,
                consentPurpose: body.consentPurpose,
                generatePdf: body.generatePdf !== false,
                referenceId: body.referenceId,
            });
        } else {
            const [profile, kyc] = await Promise.all([
                UserProfile.findOne({ user: userId }),
                Kyc.findOne({ user: userId }),
            ]);

            const nameFromProfile = [profile?.firstName, profile?.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();

            const name = body.name?.trim() || nameFromProfile || null;
            const resolvedMobile = mobile || user.mobile;
            const email = body.email?.trim() || user.email || null;
            const pan =
                body.pan?.trim()?.toUpperCase() || kyc?.panNumber || null;

            if (!name) {
                throw new ApiError(
                    400,
                    "Name is required. Complete your profile or pass name in request"
                );
            }
            if (!email) {
                throw new ApiError(
                    400,
                    "Email is required. Complete your profile or pass email in request"
                );
            }
            if (!pan) {
                throw new ApiError(
                    400,
                    "PAN is required. Complete KYC or pass pan in request"
                );
            }

            report = await exports.fetchCreditReportSummary({
                userId,
                source: "USER",
                subjectType: "SELF",
                name,
                mobile: resolvedMobile,
                email,
                pan,
                consent: body.consent !== false,
                consentPurpose: body.consentPurpose,
                generatePdf: body.generatePdf !== false,
                referenceId: body.referenceId,
            });
        }

        await paymentService.attachCreditReportReference(
            claimedPayment._id,
            report?.id || report?._id
        );

        return report;
    } catch (error) {
        // Allow retry with same payment if report fetch itself failed after claim
        if (claimedPayment?._id) {
            const Payment = require("../payments/model");
            const {
                PAYMENT_STATUSES,
            } = require("../../../integrations/razorpay/constants");
            await Payment.updateOne(
                {
                    _id: claimedPayment._id,
                    status: PAYMENT_STATUSES.CONSUMED,
                    referenceType: null,
                },
                {
                    $set: {
                        status: PAYMENT_STATUSES.PAID,
                        consumedAt: null,
                    },
                }
            );
        }
        throw error;
    }
};

/**
 * Admin can check any person's credit (registered or external).
 * Body: name, email, pan, mobile/phone only.
 */
exports.fetchByAdmin = async (adminId, body = {}) => {
    const name = body.name?.trim();
    const mobile = String(body.mobile || body.phone || "").trim();
    const email = body.email?.trim();
    const pan = body.pan?.trim()?.toUpperCase();

    const existingUser = await userRepository.findByMobile(mobile);

    return exports.fetchCreditReportSummary({
        userId: existingUser?._id || null,
        checkedBy: adminId,
        source: "ADMIN",
        subjectType: "OTHER",
        name,
        mobile,
        email,
        pan,
        consent: body.consent !== false,
        consentPurpose: body.consentPurpose,
        generatePdf: body.generatePdf !== false,
        referenceId: body.referenceId,
    });
};

exports.getMyReports = async (userId, query = {}) => {
    const limit = Math.min(Number(query.limit) || 20, 50);
    const items = await creditReportRepository.findByUserId(userId, { limit });
    return items.map((item) => formatCreditReport(item));
};

exports.getMyLatestReport = async (userId) => {
    const report = await creditReportRepository.findLatestByUserId(userId);
    if (!report) {
        throw new ApiError(404, "No successful credit report found");
    }
    return formatCreditReport(report, { includeRaw: true });
};

exports.getReportById = async (userId, reportId, { asAdmin = false } = {}) => {
    const report = asAdmin
        ? await creditReportRepository.findAdminById(reportId)
        : await creditReportRepository.findById(reportId);
    if (!report) {
        throw new ApiError(404, "Credit report not found");
    }
    if (
        !asAdmin &&
        (!report.user || report.user.toString() !== userId.toString())
    ) {
        throw new ApiError(403, "Access denied");
    }
    // User detail + admin detail both need Decentro raw for custom UI
    return formatCreditReport(report, { includeRaw: true });
};

/**
 * Admin view of one user's full credit checklist + related checks
 * (same mobile checked by admin / others).
 */
exports.getAdminUserChecklist = async (targetUserId, query = {}) => {
    const user = await userRepository.findById(targetUserId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Number(query.limit) || 20, 100);

    const result = await creditReportRepository.listForUserAdmin(
        targetUserId,
        user.mobile,
        { page, limit }
    );

    const ownedCount = await creditReportRepository.model.countDocuments({
        user: targetUserId,
    });
    const aboutCount = user.mobile
        ? await creditReportRepository.model.countDocuments({
              mobile: user.mobile,
          })
        : 0;

    return {
        user: {
            id: user._id,
            mobile: user.mobile,
            email: user.email || "",
            status: user.status,
        },
        summary: {
            totalRelated: result.pagination.total,
            ownedByUser: ownedCount,
            aboutThisMobile: aboutCount,
        },
        items: result.items.map((item) => {
            const formatted = formatCreditReport(item);
            const ownerId = formatted.userId?.toString?.() || formatted.userId;
            formatted.belongsToUser =
                ownerId && ownerId.toString() === targetUserId.toString();
            formatted.isAboutUser =
                Boolean(user.mobile) && formatted.mobile === user.mobile;
            return formatted;
        }),
        pagination: result.pagination,
    };
};

exports.listAdminReports = async (query = {}) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Number(query.limit) || 20, 100);
    const filter = {};

    if (query.status) filter.status = query.status;
    if (query.mobile) filter.mobile = query.mobile.trim();
    if (query.pan) filter.pan = String(query.pan).trim().toUpperCase();
    if (query.name) filter.name = new RegExp(query.name.trim(), "i");
    if (query.userId) filter.user = query.userId;
    if (query.subjectType === "SELF" || query.subjectType === "OTHER") {
        filter.subjectType = query.subjectType;
    }
    if (query.source === "USER" || query.source === "ADMIN") {
        filter.source = query.source;
    }
    if (query.minScore != null) {
        filter.score = { ...(filter.score || {}), $gte: Number(query.minScore) };
    }
    if (query.maxScore != null) {
        filter.score = { ...(filter.score || {}), $lte: Number(query.maxScore) };
    }

    const result = await creditReportRepository.listAdmin(filter, {
        page,
        limit,
    });

    return {
        items: result.items.map((item) => formatCreditReport(item)),
        pagination: result.pagination,
    };
};

/**
 * Rebuild CredAxis-branded PDF from stored rawResponse (admin).
 */
exports.regeneratePdf = async (reportId) => {
    const report = await creditReportRepository.findAdminById(reportId);
    if (!report) {
        throw new ApiError(404, "Credit report not found");
    }
    if (!report.rawResponse) {
        throw new ApiError(
            400,
            "No raw bureau response stored for this report"
        );
    }

    let pdfPath;
    try {
        const previousReports = await loadPreviousReportsForPdf(
            report.user,
            report.referenceId
        );
        pdfPath = await buildAndSaveCredAxisPdf(report.rawResponse, {
            referenceId: report.referenceId,
            name: report.name,
            pan: report.pan,
            mobile: report.mobile,
            email: report.email,
            decentroTxnId: report.decentroTxnId,
            generatedAt: new Date(),
            previousReports,
        });
    } catch (err) {
        throw new ApiError(
            500,
            `PDF generation failed: ${err.message || "unknown error"}`
        );
    }

    if (!pdfPath) {
        throw new ApiError(
            400,
            "Could not build PDF — CIR report data missing in raw response"
        );
    }

    if (report.pdfPath && report.pdfPath !== pdfPath) {
        try {
            deleteUploadFile(report.pdfPath);
        } catch {
            // ignore cleanup errors
        }
    }

    report.pdfPath = pdfPath;
    await report.save();

    return formatCreditReport(report, { includeRaw: true });
};

exports.VALID_INQUIRY_PURPOSES = VALID_INQUIRY_PURPOSES;
