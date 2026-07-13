exports.formatKyc = (kyc) => {
    if (!kyc) {
        return null;
    }

    const data = kyc.toObject ? kyc.toObject() : kyc;

    return {
        id: data._id,
        userId: data.user?._id || data.user,
        panNumber: data.panNumber || "",
        aadhaarNumber: data.aadhaarNumber || "",
        panImage: data.panImage || null,
        aadhaarFront: data.aadhaarFront || null,
        aadhaarBack: data.aadhaarBack || null,
        selfie: data.selfie || null,
        status: data.status,
        remarks: data.remarks || "",
        verifiedAt: data.verifiedAt || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};
