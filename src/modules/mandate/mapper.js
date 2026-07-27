exports.formatMandate = (doc) => {
    if (!doc) return null;
    const data = doc.toObject ? doc.toObject() : doc;

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
        checkoutUrl: data.checkoutUrl,
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
