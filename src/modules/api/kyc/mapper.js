exports.formatKyc = (kyc, profileMap = {}) => {
    if (!kyc) {
        return null;
    }

    const data = kyc.toObject ? kyc.toObject() : kyc;
    const user = data.user;
    const userId = (user?._id || user)?.toString?.() || user;
    const profile = profileMap[userId] || null;

    const firstName = profile?.firstName || "";
    const lastName = profile?.lastName || "";
    const fullName =
        profile?.fullName ||
        [firstName, lastName].filter(Boolean).join(" ") ||
        "";

    let userPayload = null;

    if (user && typeof user === "object" && (user.mobile !== undefined || user._id)) {
        userPayload = {
            id: user._id || userId,
            mobile: user.mobile || "",
            email: user.email || "",
            firstName,
            lastName,
            fullName: fullName || null,
        };
    } else if (userId) {
        userPayload = {
            id: userId,
            mobile: "",
            email: "",
            firstName,
            lastName,
            fullName: fullName || null,
        };
    }

    const documents = [
        {
            key: "panNumber",
            label: "PAN Number",
            type: "text",
            value: data.panNumber || "",
            complete: Boolean(data.panNumber),
        },
        {
            key: "aadhaarNumber",
            label: "Aadhaar Number",
            type: "text",
            value: data.aadhaarNumber || "",
            complete: Boolean(data.aadhaarNumber),
        },
        {
            key: "accountHolderName",
            label: "Account Holder Name",
            type: "text",
            value: data.accountHolderName || "",
            complete: Boolean(data.accountHolderName),
        },
        {
            key: "bankName",
            label: "Bank Name",
            type: "text",
            value: data.bankName || "",
            complete: Boolean(data.bankName),
        },
        {
            key: "accountNumber",
            label: "Account Number",
            type: "text",
            value: data.accountNumber || "",
            complete: Boolean(data.accountNumber),
        },
        {
            key: "ifscCode",
            label: "IFSC Code",
            type: "text",
            value: data.ifscCode || "",
            complete: Boolean(data.ifscCode),
        },
        {
            key: "accountType",
            label: "Account Type",
            type: "text",
            value: data.accountType || "",
            complete: Boolean(data.accountType),
        },
        {
            key: "panImage",
            label: "PAN Image",
            type: "file",
            value: data.panImage || null,
            complete: Boolean(data.panImage),
        },
        {
            key: "aadhaarFront",
            label: "Aadhaar Front",
            type: "file",
            value: data.aadhaarFront || null,
            complete: Boolean(data.aadhaarFront),
        },
        {
            key: "aadhaarBack",
            label: "Aadhaar Back",
            type: "file",
            value: data.aadhaarBack || null,
            complete: Boolean(data.aadhaarBack),
        },
        {
            key: "selfie",
            label: "Selfie",
            type: "file",
            value: data.selfie || null,
            complete: Boolean(data.selfie),
        },
    ];

    const missingDocs = documents
        .filter((doc) => !doc.complete)
        .map((doc) => doc.label);
    const completedCount = documents.filter((doc) => doc.complete).length;

    return {
        id: data._id,
        userId,
        user: userPayload,
        panNumber: data.panNumber || "",
        aadhaarNumber: data.aadhaarNumber || "",
        accountHolderName: data.accountHolderName || "",
        bankName: data.bankName || "",
        accountNumber: data.accountNumber || "",
        ifscCode: data.ifscCode || "",
        accountType: data.accountType || "",
        panImage: data.panImage || null,
        aadhaarFront: data.aadhaarFront || null,
        aadhaarBack: data.aadhaarBack || null,
        selfie: data.selfie || null,
        status: data.status,
        remarks: data.remarks || "",
        verifiedAt: data.verifiedAt || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        documents,
        missingDocs,
        completedCount,
        totalDocs: documents.length,
        isComplete: missingDocs.length === 0,
    };
};

/** Synthetic row for users who never submitted KYC (admin queue). */
exports.formatNotSubmittedKyc = (user, profile = null) => {
    const data = user.toObject ? user.toObject() : user;
    const userId = (data._id || data.id)?.toString?.() || data._id;
    const firstName = profile?.firstName || "";
    const lastName = profile?.lastName || "";
    const fullName =
        profile?.fullName ||
        [firstName, lastName].filter(Boolean).join(" ") ||
        "";

    const documents = [
        {
            key: "panNumber",
            label: "PAN Number",
            type: "text",
            value: "",
            complete: false,
        },
        {
            key: "aadhaarNumber",
            label: "Aadhaar Number",
            type: "text",
            value: "",
            complete: false,
        },
        {
            key: "accountHolderName",
            label: "Account Holder Name",
            type: "text",
            value: "",
            complete: false,
        },
        {
            key: "bankName",
            label: "Bank Name",
            type: "text",
            value: "",
            complete: false,
        },
        {
            key: "accountNumber",
            label: "Account Number",
            type: "text",
            value: "",
            complete: false,
        },
        {
            key: "ifscCode",
            label: "IFSC Code",
            type: "text",
            value: "",
            complete: false,
        },
        {
            key: "accountType",
            label: "Account Type",
            type: "text",
            value: "",
            complete: false,
        },
        {
            key: "panImage",
            label: "PAN Image",
            type: "file",
            value: null,
            complete: false,
        },
        {
            key: "aadhaarFront",
            label: "Aadhaar Front",
            type: "file",
            value: null,
            complete: false,
        },
        {
            key: "aadhaarBack",
            label: "Aadhaar Back",
            type: "file",
            value: null,
            complete: false,
        },
        {
            key: "selfie",
            label: "Selfie",
            type: "file",
            value: null,
            complete: false,
        },
    ];

    const missingDocs = documents.map((doc) => doc.label);

    return {
        id: `not-submitted-${userId}`,
        userId,
        user: {
            id: userId,
            mobile: data.mobile || "",
            email: data.email || "",
            firstName,
            lastName,
            fullName: fullName || null,
        },
        panNumber: "",
        aadhaarNumber: "",
        accountHolderName: "",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        accountType: "",
        panImage: null,
        aadhaarFront: null,
        aadhaarBack: null,
        selfie: null,
        status: "NOT_SUBMITTED",
        remarks: "",
        verifiedAt: null,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        documents,
        missingDocs,
        completedCount: 0,
        totalDocs: documents.length,
        isComplete: false,
        notSubmitted: true,
    };
};

/** Compact KYC for embedding in user/partner admin details */
exports.formatKycSummary = (kyc) => {
    if (!kyc) {
        return {
            status: "NOT_SUBMITTED",
            panNumber: "",
            aadhaarNumber: "",
            accountHolderName: "",
            bankName: "",
            accountNumber: "",
            ifscCode: "",
            accountType: "",
            panImage: null,
            aadhaarFront: null,
            aadhaarBack: null,
            selfie: null,
            remarks: "",
            verifiedAt: null,
        };
    }

    const data = kyc.toObject ? kyc.toObject() : kyc;

    return {
        id: data._id,
        status: data.status || "NOT_SUBMITTED",
        panNumber: data.panNumber || "",
        aadhaarNumber: data.aadhaarNumber || "",
        accountHolderName: data.accountHolderName || "",
        bankName: data.bankName || "",
        accountNumber: data.accountNumber || "",
        ifscCode: data.ifscCode || "",
        accountType: data.accountType || "",
        panImage: data.panImage || null,
        aadhaarFront: data.aadhaarFront || null,
        aadhaarBack: data.aadhaarBack || null,
        selfie: data.selfie || null,
        remarks: data.remarks || "",
        verifiedAt: data.verifiedAt || null,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
    };
};
