const Mandate = require("./mandate.model");
const Installment = require("./installment.model");
const MandateTransaction = require("./transaction.model");

const amountValue = (party) => {
    if (!party) return null;
    if (party.amount && typeof party.amount === "object") {
        return party.amount.value ?? null;
    }
    return null;
};

const extractMode = (raw) =>
    raw?.client_meta?.mode || raw?.payer?.mode || "UPI_AUTO_PAY";

const extractTxns = (raw) => {
    const txns = raw?.meta?.txns;
    return Array.isArray(txns) ? txns : [];
};

const upsertMandateTxns = async (mandateDoc, raw) => {
    const txns = extractTxns(raw);
    for (const txn of txns) {
        if (!txn?.id) continue;
        await MandateTransaction.findOneAndUpdate(
            { rocketpayTxnId: String(txn.id), entityType: "MANDATE" },
            {
                $set: {
                    rocketpayTxnId: String(txn.id),
                    mandate: mandateDoc._id,
                    rocketpayMandateId: mandateDoc.rocketpayId,
                    entityType: "MANDATE",
                    state: txn.state || null,
                    medium: txn.medium || null,
                    utr: txn.utr || null,
                    genericError: txn.generic_error ?? null,
                    txnMeta: txn.meta || null,
                    txnCreatedAt: txn.created_at
                        ? new Date(txn.created_at)
                        : null,
                    raw: txn,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }
};

const upsertInstallmentTxns = async (installmentDoc, raw) => {
    const txns = extractTxns(raw);
    for (const txn of txns) {
        if (!txn?.id) continue;
        await MandateTransaction.findOneAndUpdate(
            { rocketpayTxnId: String(txn.id), entityType: "INSTALLMENT" },
            {
                $set: {
                    rocketpayTxnId: String(txn.id),
                    installment: installmentDoc._id,
                    mandate: installmentDoc.mandate || null,
                    rocketpayMandateId: installmentDoc.rocketpayMandateId,
                    rocketpayInstallmentId: installmentDoc.rocketpayId,
                    entityType: "INSTALLMENT",
                    state: txn.state || null,
                    medium: txn.medium || null,
                    utr: txn.utr || null,
                    genericError: txn.generic_error ?? null,
                    txnMeta: txn.meta || null,
                    txnCreatedAt: txn.created_at
                        ? new Date(txn.created_at)
                        : null,
                    raw: txn,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }
};

/**
 * Upsert local mandate from RocketPay mandate entity.
 */
exports.syncMandateFromRocketPay = async (
    raw,
    {
        userId = null,
        referenceId = null,
        schedule = null,
        source = "API",
        distributor = null,
        clientMetaOverride = null,
    } = {}
) => {
    if (!raw || !raw.id) {
        return null;
    }

    const existingDoc = await Mandate.findOne({ rocketpayId: String(raw.id) });
    const resolvedReferenceId =
        referenceId || raw.reference_id || existingDoc?.referenceId || null;

    const set = {
        rocketpayId: String(raw.id),
        referenceId: resolvedReferenceId,
        referenceType: raw.reference_type || "MAIN",
        state: raw.state || "CREATED",
        frequency: raw.frequency || null,
        mode: extractMode(raw),
        customerMobile: raw.payer?.account?.mobile_number || null,
        customerName: raw.payer?.account?.name || null,
        approvalAmount: raw.approval_amount ?? amountValue(raw.payer),
        advanceAmount: raw.advance_amount ?? null,
        installmentCount: raw.installment_count ?? null,
        startDate: raw.start_date || null,
        endDate: raw.end_date || null,
        timeZone: raw.time_zone || "Asia/Kolkata",
        paymentOrderId: raw.payment_order_id || null,
        mmsId: raw.mms_id || null,
        checkoutUrl:
            raw.meta?.mandate_auth_checkout_url ||
            raw.meta?.return_url ||
            null,
        payer: raw.payer || null,
        payees: raw.payees || null,
        clientMeta: clientMetaOverride || raw.client_meta || null,
        meta: raw.meta || null,
        deleted: Boolean(raw.deleted),
        raw,
        lastSyncedAt: new Date(),
        source,
    };

    if (schedule) {
        set.schedule = schedule;
    }

    if (distributor) {
        set.distributor = {
            userId: distributor.userId || null,
            name: distributor.name || null,
            mobile: distributor.mobile || null,
            email: distributor.email || null,
            businessName: distributor.businessName || null,
            businessType: distributor.businessType || null,
            rocketpayAccountId: distributor.rocketpayAccountId || null,
        };
    }

    // Never overwrite an existing owner (admin refresh/recon must not steal user).
    if (!existingDoc?.user && userId) {
        set.user = userId;
    }

    const doc = await Mandate.findOneAndUpdate(
        { rocketpayId: String(raw.id) },
        { $set: set },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (!doc.user && userId) {
        doc.user = userId;
        await doc.save();
    }

    await upsertMandateTxns(doc, raw);
    return doc;
};

/**
 * Upsert local installment from RocketPay installment entity.
 */
exports.syncInstallmentFromRocketPay = async (
    raw,
    { userId = null, mandateDoc = null, source = "API" } = {}
) => {
    if (!raw || !raw.id) {
        return null;
    }

    let mandate = mandateDoc;
    if (!mandate && raw.mandate_id) {
        mandate = await Mandate.findOne({
            rocketpayId: String(raw.mandate_id),
        });
    }

    const set = {
        rocketpayId: String(raw.id),
        rocketpayMandateId: raw.mandate_id ? String(raw.mandate_id) : null,
        mandate: mandate?._id || null,
        referenceId: raw.reference_id ?? null,
        referenceType: raw.reference_type || "MAIN",
        state: raw.state || "CREATED",
        dueDate: raw.due_date || null,
        scheduleDate: raw.schedule_date || null,
        timeZone: raw.time_zone || "Asia/Kolkata",
        amount: amountValue(raw.payer),
        paymentOrderId: raw.payment_order_id || null,
        mmsId: raw.mms_id || null,
        payer: raw.payer || null,
        payees: raw.payees || null,
        clientMeta: raw.client_meta || null,
        meta: raw.meta || null,
        deleted: Boolean(raw.deleted),
        raw,
        lastSyncedAt: new Date(),
        source,
    };

    // Prefer existing owner → parent mandate user → caller userId
    const existingInstallment = await Installment.findOne({
        rocketpayId: String(raw.id),
    }).select("user");
    const resolvedUser =
        existingInstallment?.user || mandate?.user || userId || null;
    if (resolvedUser) {
        set.user = resolvedUser;
    }

    const doc = await Installment.findOneAndUpdate(
        { rocketpayId: String(raw.id) },
        { $set: set },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await upsertInstallmentTxns(doc, raw);
    return doc;
};

exports.isMandateEntity = (payload) => {
    if (!payload || typeof payload !== "object") return false;
    // Mandate has frequency / approval_amount; installment has mandate_id + due_date
    if (payload.mandate_id && (payload.due_date || payload.schedule_date)) {
        return false;
    }
    return Boolean(
        payload.frequency ||
            payload.approval_amount != null ||
            payload.payer?.tag === "CUSTOMER_COLLECTION"
    );
};
