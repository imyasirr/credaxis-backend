/**
 * RocketPay stores customer auth (QR / UPI deep-link / share checkout) under
 * meta.txns[].meta.auth_meta — see MandateDocs entities → Mandate Response.
 * Prefer latest usable QR txn, else latest LINK txn.
 */
function extractMandateAuth(meta, checkoutUrlFallback) {
    const txns = Array.isArray(meta?.txns) ? meta.txns : [];
    const withAuth = txns.filter((t) => t?.meta?.auth_meta);

    const preferQr = [...withAuth]
        .reverse()
        .find((t) => t.meta.auth_meta.QR || String(t.medium || "").toUpperCase() === "QR");
    const preferLink = [...withAuth]
        .reverse()
        .find((t) => String(t.medium || "").toUpperCase() === "LINK");
    const pick = preferQr || preferLink || withAuth[withAuth.length - 1] || null;

    const authMeta = pick?.meta?.auth_meta || {};
    const qr = authMeta.QR || null;
    const checkoutUrl =
        meta?.mandate_auth_checkout_url ||
        meta?.return_url ||
        checkoutUrlFallback ||
        null;

    return {
        checkoutUrl,
        /** Same as checkoutUrl — open in WebView / share as link */
        shareUrl: checkoutUrl,
        /** upi://mandate?... deep link OR gateway QR / simulator URL */
        qr,
        medium: pick?.medium || (qr ? "QR" : checkoutUrl ? "LINK" : null),
        token: authMeta.token || null,
        gatewayName: authMeta.gateway_name || null,
        gatewayReferenceId: authMeta.gateway_reference_id || null,
        txnState: pick?.state || null,
        txnId: pick?.id || null,
    };
}

exports.extractMandateAuth = extractMandateAuth;

exports.formatMandate = (doc) => {
    if (!doc) return null;
    const data = doc.toObject ? doc.toObject() : doc;
    const auth = extractMandateAuth(data.meta, data.checkoutUrl);

    return {
        id: data._id,
        rocketpayId: data.rocketpayId,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
        state: data.state,
        frequency: data.frequency,
        mode: data.mode,
        customerMobile: data.customerMobile,
        customerName: data.customerName,
        approvalAmount: data.approvalAmount,
        advanceAmount: data.advanceAmount,
        installmentCount: data.installmentCount,
        startDate: data.startDate,
        endDate: data.endDate,
        timeZone: data.timeZone,
        paymentOrderId: data.paymentOrderId,
        mmsId: data.mmsId,
        checkoutUrl: auth.checkoutUrl || data.checkoutUrl || null,
        /** Mobile helper: QR + share/checkout for UPI Autopay auth UI */
        auth,
        payer: data.payer,
        payees: data.payees,
        clientMeta: data.clientMeta,
        meta: data.meta,
        schedule: data.schedule,
        deleted: data.deleted,
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
        raw: data.raw,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.formatInstallment = (doc) => {
    if (!doc) return null;
    const data = doc.toObject ? doc.toObject() : doc;

    return {
        id: data._id,
        rocketpayId: data.rocketpayId,
        rocketpayMandateId: data.rocketpayMandateId,
        mandate: data.mandate?._id || data.mandate || null,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
        state: data.state,
        dueDate: data.dueDate,
        scheduleDate: data.scheduleDate,
        timeZone: data.timeZone,
        amount: data.amount,
        paymentOrderId: data.paymentOrderId,
        mmsId: data.mmsId,
        payer: data.payer,
        payees: data.payees,
        clientMeta: data.clientMeta,
        meta: data.meta,
        deleted: data.deleted,
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
        raw: data.raw,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.formatTransaction = (doc) => {
    if (!doc) return null;
    const data = doc.toObject ? doc.toObject() : doc;

    return {
        id: data._id,
        rocketpayTxnId: data.rocketpayTxnId,
        entityType: data.entityType,
        rocketpayMandateId: data.rocketpayMandateId,
        rocketpayInstallmentId: data.rocketpayInstallmentId,
        mandate: data.mandate,
        installment: data.installment,
        state: data.state,
        medium: data.medium,
        utr: data.utr,
        genericError: data.genericError,
        txnMeta: data.txnMeta,
        txnCreatedAt: data.txnCreatedAt,
        raw: data.raw,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.formatWebhookLog = (doc) => {
    if (!doc) return null;
    const data = doc.toObject ? doc.toObject() : doc;

    return {
        id: data._id,
        entityType: data.entityType,
        rocketpayEntityId: data.rocketpayEntityId,
        mandate: data.mandate,
        installment: data.installment,
        payload: data.payload,
        headers: data.headers,
        ipAddress: data.ipAddress,
        processed: data.processed,
        processError: data.processError,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

exports.formatApiLog = (doc) => {
    if (!doc) return null;
    const data = doc.toObject ? doc.toObject() : doc;

    return {
        id: data._id,
        user: data.user
            ? data.user._id
                ? {
                      id: data.user._id,
                      mobile: data.user.mobile || "",
                      email: data.user.email || "",
                  }
                : { id: data.user }
            : null,
        apiName: data.apiName,
        method: data.method,
        path: data.path,
        request: data.request,
        response: data.response,
        statusCode: data.statusCode,
        status: data.status,
        ipAddress: data.ipAddress,
        error: data.error,
        rocketpayMandateId: data.rocketpayMandateId,
        rocketpayInstallmentId: data.rocketpayInstallmentId,
        durationMs: data.durationMs,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};
