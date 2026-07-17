const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");

const decentroClient = require("../../integrations/decentro/decentro.client");
const creditReportRepository = require("./creditReport.repository");
const userRepository = require("../user/user.repository");
const UserProfile = require("../user/userProfile.model");
const Kyc = require("../kyc/kyc.model");

const ApiError = require("../../utils/ApiError");
const { getUploadPath } = require("../../middleware/upload.middleware");
const { formatCreditReport } = require("./creditReport.mapper");

const CREDIT_REPORT_PATH =
    process.env.DECENTRO_CREDIT_REPORT_PATH ||
    "/v2/financial_services/credit_bureau/credit_report/summary";

const VALID_INQUIRY_PURPOSES = ["BL", "CC", "CL", "HL", "GL", "PL"];

const CONSENT_PURPOSE_DEFAULT =
    "To fetch Equifax credit report summary for CredAxis credit score check";

const ensureCreditReportDir = () => {
    const dir = path.join(
        __dirname,
        "../../../public/uploads/credit-reports"
    );
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
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

/**
 * Reusable Decentro Equifax credit report fetch.
 * Saves raw JSON + indexed fields + optional PDF.
 */
exports.fetchCreditReportSummary = async ({
    userId = null,
    checkedBy = null,
    source = "USER",
    subjectType = "SELF",
    name,
    mobile,
    consent = true,
    consentPurpose = CONSENT_PURPOSE_DEFAULT,
    inquiryPurpose = "PL",
    dateOfBirth,
    addressType,
    address,
    pincode,
    documentType,
    documentId,
    generatePdf = true,
    referenceId,
}) => {
    if (!consent) {
        throw new ApiError(400, "Consent must be true to fetch credit report");
    }

    const purpose = String(inquiryPurpose || "PL").toUpperCase().trim();
    if (!VALID_INQUIRY_PURPOSES.includes(purpose)) {
        throw new ApiError(
            400,
            `Invalid inquiry_purpose. Allowed: ${VALID_INQUIRY_PURPOSES.join(", ")}`
        );
    }

    const cleanName = String(name || "").trim();
    const cleanMobile = String(mobile || "").trim();

    if (!cleanName || cleanName.length < 2) {
        throw new ApiError(400, "Name is required (2-40 characters)");
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
        throw new ApiError(400, "Valid 10-digit mobile is required");
    }

    const refId = referenceId || buildReferenceId();

    const existing = await creditReportRepository.findByReferenceId(refId);
    if (existing) {
        throw new ApiError(400, "Duplicate reference_id");
    }

    const payload = {
        reference_id: refId,
        consent: true,
        consent_purpose:
            consentPurpose.length >= 20
                ? consentPurpose
                : CONSENT_PURPOSE_DEFAULT,
        name: cleanName.slice(0, 40),
        mobile: cleanMobile,
        inquiry_purpose: purpose,
        generate_pdf: Boolean(generatePdf),
    };

    if (dateOfBirth) payload.date_of_birth = dateOfBirth;
    if (addressType) payload.address_type = addressType;
    if (address) payload.address = address;
    if (pincode) payload.pincode = String(pincode);
    if (documentType) payload.document_type = documentType;
    if (documentId) payload.document_id = String(documentId).toUpperCase();

    const record = await creditReportRepository.create({
        user: userId || null,
        checkedBy: checkedBy || null,
        source: source === "ADMIN" ? "ADMIN" : "USER",
        subjectType: subjectType === "OTHER" ? "OTHER" : "SELF",
        referenceId: refId,
        provider: "EQUIFAX",
        status: "PENDING",
        name: cleanName,
        mobile: cleanMobile,
        pan: documentType === "PAN" ? documentId?.toUpperCase() : null,
        inquiryPurpose: purpose,
        requestPayload: payload,
    });

    const { statusCode, data: raw } = await decentroClient.post(
        CREDIT_REPORT_PATH,
        payload
    );

    const decentroStatus = String(raw?.status || "").toUpperCase();
    const isHttpOk = statusCode >= 200 && statusCode < 300;
    const isApiSuccess = decentroStatus === "SUCCESS";

    let pdfPath = null;
    let extracted;

    if (isHttpOk && isApiSuccess) {
        extracted = extractIndexedFields(raw, {
            name: cleanName,
            pan: payload.document_id || null,
        });
        // Prefer bureau-returned name when available, else request name
        const pdfName = extracted.name || cleanName;
        pdfPath = savePdfFromResponse(raw, pdfName, refId);
    } else {
        extracted = {
            status: "FAILED",
            name: cleanName,
            pan: payload.document_id || null,
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
    record.pan = extracted.pan;
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
        throw new ApiError(
            statusCode >= 400 && statusCode < 500 ? statusCode : 502,
            extracted.errorMessage || "Credit report fetch failed"
        );
    }

    return formatCreditReport(record, { includeRaw: false });
};

/**
 * Prefill name/mobile/PAN/DOB from profile + KYC when possible,
 * then call Equifax summary.
 */
exports.fetchForUser = async (userId, body = {}) => {
    const user = await userRepository.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // forSelf=false → user is checking someone else. Do NOT prefill from
    // the requester's own profile/KYC, otherwise the wrong person's data
    // (DOB/PAN/address) would be sent to the bureau.
    const forSelf = body.forSelf !== false;

    if (!forSelf) {
        const name = body.name?.trim();
        const mobile = body.mobile?.trim();

        if (!name || name.length < 2) {
            throw new ApiError(
                400,
                "Name is required when checking someone else"
            );
        }
        if (!/^[6-9]\d{9}$/.test(mobile || "")) {
            throw new ApiError(
                400,
                "Valid 10-digit mobile is required when checking someone else"
            );
        }

        const pan =
            body.documentId?.trim()?.toUpperCase() ||
            body.pan?.trim()?.toUpperCase() ||
            null;

        return exports.fetchCreditReportSummary({
            userId,
            source: "USER",
            subjectType: "OTHER",
            name,
            mobile,
            consent: body.consent !== false,
            consentPurpose: body.consentPurpose,
            inquiryPurpose: body.inquiryPurpose || "PL",
            dateOfBirth: body.dateOfBirth || null,
            addressType: body.addressType,
            address: body.address,
            pincode: body.pincode,
            documentType: pan ? body.documentType || "PAN" : body.documentType,
            documentId: pan || body.documentId,
            generatePdf: body.generatePdf !== false,
            referenceId: body.referenceId,
        });
    }

    const [profile, kyc] = await Promise.all([
        UserProfile.findOne({ user: userId }),
        Kyc.findOne({ user: userId }),
    ]);

    const nameFromProfile = [profile?.firstName, profile?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

    const name =
        body.name?.trim() ||
        nameFromProfile ||
        null;

    if (!name) {
        throw new ApiError(
            400,
            "Name is required. Complete your profile or pass name in request"
        );
    }

    const mobile = body.mobile?.trim() || user.mobile;
    const pan =
        body.documentId?.trim()?.toUpperCase() ||
        body.pan?.trim()?.toUpperCase() ||
        kyc?.panNumber ||
        null;

    let dateOfBirth = body.dateOfBirth || null;
    if (!dateOfBirth && profile?.dob) {
        dateOfBirth = new Date(profile.dob).toISOString().slice(0, 10);
    }

    return exports.fetchCreditReportSummary({
        userId,
        source: "USER",
        subjectType: "SELF",
        name,
        mobile,
        consent: body.consent !== false,
        consentPurpose: body.consentPurpose,
        inquiryPurpose: body.inquiryPurpose || "PL",
        dateOfBirth,
        addressType: body.addressType || (profile?.address ? "H" : undefined),
        address: body.address || profile?.address || undefined,
        pincode: body.pincode || profile?.pincode || undefined,
        documentType: pan ? body.documentType || "PAN" : body.documentType,
        documentId: pan || body.documentId,
        generatePdf: body.generatePdf !== false,
        referenceId: body.referenceId,
    });
};

/**
 * Admin can check any person's credit (registered or external).
 * Saves into the same credit-reports checklist.
 * If mobile matches an app user, links that user.
 */
exports.fetchByAdmin = async (adminId, body = {}) => {
    const name = body.name?.trim();
    const mobile = body.mobile?.trim();

    if (!name || name.length < 2) {
        throw new ApiError(400, "Name is required (2-40 characters)");
    }
    if (!/^[6-9]\d{9}$/.test(mobile || "")) {
        throw new ApiError(400, "Valid 10-digit mobile is required");
    }

    const existingUser = await userRepository.findByMobile(mobile);
    const pan =
        body.documentId?.trim()?.toUpperCase() ||
        body.pan?.trim()?.toUpperCase() ||
        null;

    return exports.fetchCreditReportSummary({
        userId: existingUser?._id || null,
        checkedBy: adminId,
        source: "ADMIN",
        subjectType: "OTHER",
        name,
        mobile,
        consent: body.consent !== false,
        consentPurpose: body.consentPurpose,
        inquiryPurpose: body.inquiryPurpose || "PL",
        dateOfBirth: body.dateOfBirth || null,
        addressType: body.addressType,
        address: body.address,
        pincode: body.pincode,
        documentType: pan ? body.documentType || "PAN" : body.documentType,
        documentId: pan || body.documentId,
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
    return formatCreditReport(report, { includeRaw: false });
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
    return formatCreditReport(report, { includeRaw: asAdmin });
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

exports.VALID_INQUIRY_PURPOSES = VALID_INQUIRY_PURPOSES;
