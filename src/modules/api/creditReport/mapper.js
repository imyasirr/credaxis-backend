const publicBaseUrl = () =>
    String(process.env.PUBLIC_BASE_URL || process.env.APP_URL || "")
        .trim()
        .replace(/\/$/, "");

exports.formatCreditReport = (doc, { includeRaw = false } = {}) => {
    if (!doc) return null;

    const data = doc.toObject ? doc.toObject() : doc;
    const pdfPath = data.pdfPath || null;
    const base = publicBaseUrl();
    const pdfUrl = pdfPath
        ? /^https?:\/\//i.test(pdfPath)
            ? pdfPath
            : base
              ? `${base}${pdfPath.startsWith("/") ? "" : "/"}${pdfPath}`
              : pdfPath
        : null;

    const result = {
        id: data._id,
        userId: data.user?._id || data.user || null,
        checkedBy: data.checkedBy?._id || data.checkedBy || null,
        source: data.source || "USER",
        subjectType: data.subjectType || "SELF",
        referenceId: data.referenceId,
        provider: data.provider,
        status: data.status,
        name: data.name || "",
        mobile: data.mobile || "",
        email: data.email || "",
        pan: data.pan || "",
        score: data.score,
        scoreName: data.scoreName || null,
        decentroTxnId: data.decentroTxnId || null,
        responseKey: data.responseKey || null,
        message: data.message || null,
        pdfPath,
        /** Absolute URL when PUBLIC_BASE_URL / APP_URL is set; else same as pdfPath */
        pdfUrl,
        errorCode: data.errorCode || null,
        errorMessage: data.errorMessage || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };

    if (data.user && typeof data.user === "object" && data.user.mobile) {
        result.user = {
            id: data.user._id,
            mobile: data.user.mobile,
            email: data.user.email || "",
            status: data.user.status,
        };
    }

    if (
        data.checkedBy &&
        typeof data.checkedBy === "object" &&
        data.checkedBy.mobile
    ) {
        result.checkedByUser = {
            id: data.checkedBy._id,
            mobile: data.checkedBy.mobile,
            email: data.checkedBy.email || "",
            status: data.checkedBy.status,
        };
    }

    if (includeRaw) {
        result.rawResponse = data.rawResponse || null;
        result.requestPayload = data.requestPayload || null;
    }

    return result;
};
