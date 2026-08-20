exports.formatCatalogue = (data) => {
    if (!data || typeof data !== "object") return null;
    return {
        id: data.id || null,
        tac: data.tac || null,
        brand: data.brand || null,
        model: data.model || null,
        marketingName: data.marketing_name || null,
        mdmType: data.mdm_type || null,
        state: data.state || null,
        eligible: String(data.state || "").toUpperCase() === "APPROVED",
        createdAt: data.created_at || null,
        updatedAt: data.updated_at || null,
    };
};

exports.formatDlcKey = (doc) => {
    if (!doc) return null;
    const data = doc.toObject ? doc.toObject() : doc;

    return {
        id: data._id,
        rocketpaySuperKeyId: data.rocketpaySuperKeyId,
        rocketpayKeyId: data.rocketpayKeyId,
        customerName: data.customerName,
        customerMobile: data.customerMobile,
        manufacturer: data.manufacturer,
        model: data.model,
        imeiNo: data.imeiNo,
        imeiNo2: data.imeiNo2,
        mdmType: data.mdmType,
        enrolledDeviceImei: data.enrolledDeviceImei,
        status: data.status,
        keyStatus: data.keyStatus,
        isLocked: Boolean(data.isLocked),
        isDeleted: Boolean(data.isDeleted),
        isConsentGiven: Boolean(data.isConsentGiven),
        feeAmount: data.feeAmount || 0,
        journey: data.journey || [],
        deviceInfo: data.deviceInfo,
        lastSyncedAt: data.lastSyncedAt,
        source: data.source,
        user: data.user
            ? data.user._id
                ? {
                      id: data.user._id,
                      mobile: data.user.mobile || "",
                      email: data.user.email || "",
                      status: data.user.status || "",
                  }
                : { id: data.user }
            : null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.formatUnlockCode = (control) => {
    if (!control || typeof control !== "object") {
        return { codes: [] };
    }
    const items = Array.isArray(control.meta?.items)
        ? control.meta.items
        : [];
    return {
        id: control.id || null,
        name: control.name || "UNLOCK_CODE",
        codes: items.map((item) => ({
            code: item.code || null,
            isUsed: Boolean(item.is_used),
        })),
    };
};

exports.formatCoinWallet = (payload) => {
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : [];
    const coin =
        list.find(
            (w) => String(w.product_type || "").toUpperCase() === "COIN"
        ) || list[0];
    if (!coin) return { items: list };
    return {
        id: coin.id || null,
        outstanding: coin.outstanding ?? null,
        payin: coin.payin ?? null,
        payout: coin.payout ?? null,
        underPayout: coin.under_payout ?? null,
        currency: coin.currency || "COIN",
        productType: coin.product_type || "COIN",
        items: list,
    };
};
