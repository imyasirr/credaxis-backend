const Payment = require("./model");
const razorpayClient = require("../../../integrations/razorpay/razorpay.client");
const {
    PAYMENT_PURPOSES,
    PAYMENT_STATUSES,
} = require("../../../integrations/razorpay/constants");
const { formatPayment } = require("./mapper");
const creditCheckFeeService = require("./creditCheckFee.service");
const mandateCreateFeeService = require("./mandateCreateFee.service");
const ApiError = require("../../../utils/ApiError");

const PURPOSE_LABELS = {
    [PAYMENT_PURPOSES.WALLET_TOPUP]: "Wallet top-up",
    [PAYMENT_PURPOSES.CREDIT_CHECK]: "Credit score check",
    [PAYMENT_PURPOSES.MANDATE_CREATE]: "Mandate create fee",
};

const buildReceipt = (purpose) =>
    `${String(purpose).slice(0, 8)}_${Date.now().toString().slice(-8)}`;

const resolveAmount = async (purpose, amount) => {
    if (purpose === PAYMENT_PURPOSES.CREDIT_CHECK) {
        return creditCheckFeeService.resolveCreditCheckAmount();
    }

    if (purpose === PAYMENT_PURPOSES.MANDATE_CREATE) {
        return mandateCreateFeeService.resolveMandateCreateAmount();
    }

    if (purpose === PAYMENT_PURPOSES.WALLET_TOPUP) {
        const value = Number(amount);
        if (!value || value < 1) {
            throw new ApiError(400, "Amount must be at least ₹1");
        }
        return value;
    }

    throw new ApiError(400, "Unsupported payment purpose");
};

const buildCheckoutPayload = (payment, user = null) => ({
    key: razorpayClient.getPublicKey(),
    orderId: payment.razorpayOrderId,
    amount: Math.round(payment.amount * 100),
    currency: payment.currency || "INR",
    name: "CredAxis",
    description:
        payment.description ||
        PURPOSE_LABELS[payment.purpose] ||
        "CredAxis payment",
    prefill: {
        contact: user?.mobile || "",
        email: user?.email || "",
    },
    notes: {
        paymentId: String(payment._id),
        purpose: payment.purpose,
        userId: String(payment.user),
    },
});

/**
 * Create payment for WALLET_TOPUP | CREDIT_CHECK | MANDATE_CREATE.
 * CREDIT_CHECK / MANDATE_CREATE support method: ONLINE | WALLET | COINS
 */
exports.createPayment = async (userId, body = {}) => {
    const purpose = String(body.purpose || "").toUpperCase();

    if (!Object.values(PAYMENT_PURPOSES).includes(purpose)) {
        throw new ApiError(
            400,
            `purpose must be one of: ${Object.values(PAYMENT_PURPOSES).join(", ")}`
        );
    }

    if (purpose === PAYMENT_PURPOSES.CREDIT_CHECK) {
        return createCreditCheckPayment(userId, body);
    }

    if (purpose === PAYMENT_PURPOSES.MANDATE_CREATE) {
        return createMandateCreatePayment(userId, body);
    }

    return createOnlinePayment(userId, purpose, body);
};

const createCreditCheckPayment = async (userId, body = {}) => {
    const { CREDIT_CHECK_METHODS } = creditCheckFeeService;
    const method = String(body.method || CREDIT_CHECK_METHODS.ONLINE)
        .trim()
        .toUpperCase();

    if (!Object.values(CREDIT_CHECK_METHODS).includes(method)) {
        throw new ApiError(
            400,
            `method must be one of: ${Object.values(CREDIT_CHECK_METHODS).join(", ")}`
        );
    }

    const fee = await creditCheckFeeService.getCreditCheckFeeSetting();
    if (!fee.enabled) {
        throw new ApiError(400, "Credit check payments are currently disabled");
    }

    const amount = fee.amount;
    const description =
        String(body.description || "").trim() ||
        PURPOSE_LABELS[PAYMENT_PURPOSES.CREDIT_CHECK];

    const baseMeta =
        body.meta && typeof body.meta === "object" ? { ...body.meta } : {};

    if (method === CREDIT_CHECK_METHODS.ONLINE) {
        return createOnlinePayment(userId, PAYMENT_PURPOSES.CREDIT_CHECK, {
            ...body,
            description,
            meta: { ...baseMeta, method },
            _method: method,
            _amount: amount,
        });
    }

    if (method === CREDIT_CHECK_METHODS.WALLET) {
        const walletService = require("../wallet/service");
        const payment = await Payment.create({
            user: userId,
            purpose: PAYMENT_PURPOSES.CREDIT_CHECK,
            method,
            amount,
            currency: "INR",
            status: PAYMENT_STATUSES.CREATED,
            description,
            meta: {
                ...baseMeta,
                method,
                paidVia: "WALLET",
            },
        });

        try {
            const result = await walletService.debitMoney(userId, {
                amount,
                description: `Credit check — ${payment._id}`,
                referenceId: String(payment._id),
            });

            payment.status = PAYMENT_STATUSES.PAID;
            payment.paidAt = new Date();
            payment.referenceType = "WALLET_TRANSACTION";
            payment.referenceId = String(result.transaction?.id || "");
            payment.meta = {
                ...payment.meta,
                walletTransactionId: String(result.transaction?.id || ""),
            };
            await payment.save();

            return {
                payment: formatPayment(payment),
                method,
                canFetch: true,
                wallet: result.wallet,
                transaction: result.transaction,
                message:
                    "Wallet payment successful. Use paymentId with credit-reports/fetch",
            };
        } catch (err) {
            payment.status = PAYMENT_STATUSES.FAILED;
            payment.failureReason = err.message || "Wallet debit failed";
            await payment.save();
            throw err;
        }
    }

    // COINS
    const coinService = require("../coins/service");
    const coinsRequired = fee.coinsRequired;

    const payment = await Payment.create({
        user: userId,
        purpose: PAYMENT_PURPOSES.CREDIT_CHECK,
        method,
        amount,
        currency: "INR",
        status: PAYMENT_STATUSES.CREATED,
        description,
        meta: {
            ...baseMeta,
            method,
            paidVia: "COINS",
            coinsRequired,
            coinConversion: fee.coinConversion,
            conversionLabel: fee.conversionLabel,
        },
    });

    try {
        const result = await coinService.debitCoins(userId, {
            amount: coinsRequired,
            description: `Credit check — ${payment._id}`,
            referenceId: String(payment._id),
            source: "OTHER",
        });

        payment.status = PAYMENT_STATUSES.PAID;
        payment.paidAt = new Date();
        payment.referenceType = "COIN_TRANSACTION";
        payment.referenceId = String(result.transaction?.id || "");
        payment.meta = {
            ...payment.meta,
            coinsDebited: coinsRequired,
            coinTransactionId: String(result.transaction?.id || ""),
        };
        await payment.save();

        return {
            payment: formatPayment(payment),
            method,
            canFetch: true,
            coins: result.wallet,
            transaction: result.transaction,
            coinsDebited: coinsRequired,
            message:
                "Coin payment successful. Use paymentId with credit-reports/fetch",
        };
    } catch (err) {
        payment.status = PAYMENT_STATUSES.FAILED;
        payment.failureReason = err.message || "Coin debit failed";
        await payment.save();
        throw err;
    }
};

const createMandateCreatePayment = async (userId, body = {}) => {
    const { MANDATE_CREATE_METHODS } = mandateCreateFeeService;
    const method = String(body.method || MANDATE_CREATE_METHODS.ONLINE)
        .trim()
        .toUpperCase();

    if (!Object.values(MANDATE_CREATE_METHODS).includes(method)) {
        throw new ApiError(
            400,
            `method must be one of: ${Object.values(MANDATE_CREATE_METHODS).join(", ")}`
        );
    }

    const fee = await mandateCreateFeeService.getMandateCreateFeeSetting();
    if (!fee.enabled) {
        throw new ApiError(
            400,
            "Mandate create payments are currently disabled"
        );
    }

    const amount = fee.amount;
    const description =
        String(body.description || "").trim() ||
        PURPOSE_LABELS[PAYMENT_PURPOSES.MANDATE_CREATE];

    const baseMeta =
        body.meta && typeof body.meta === "object" ? { ...body.meta } : {};

    if (method === MANDATE_CREATE_METHODS.ONLINE) {
        return createOnlinePayment(userId, PAYMENT_PURPOSES.MANDATE_CREATE, {
            ...body,
            description,
            meta: { ...baseMeta, method },
            _method: method,
            _amount: amount,
        });
    }

    if (method === MANDATE_CREATE_METHODS.WALLET) {
        const walletService = require("../wallet/service");
        const payment = await Payment.create({
            user: userId,
            purpose: PAYMENT_PURPOSES.MANDATE_CREATE,
            method,
            amount,
            currency: "INR",
            status: PAYMENT_STATUSES.CREATED,
            description,
            meta: {
                ...baseMeta,
                method,
                paidVia: "WALLET",
            },
        });

        try {
            const result = await walletService.debitMoney(userId, {
                amount,
                description: `Mandate create — ${payment._id}`,
                referenceId: String(payment._id),
            });

            payment.status = PAYMENT_STATUSES.PAID;
            payment.paidAt = new Date();
            payment.referenceType = "WALLET_TRANSACTION";
            payment.referenceId = String(result.transaction?.id || "");
            payment.meta = {
                ...payment.meta,
                walletTransactionId: String(result.transaction?.id || ""),
            };
            await payment.save();

            return {
                payment: formatPayment(payment),
                method,
                canCreateMandate: true,
                wallet: result.wallet,
                transaction: result.transaction,
                message:
                    "Wallet payment successful. Use paymentId with POST /api/mandates",
            };
        } catch (err) {
            payment.status = PAYMENT_STATUSES.FAILED;
            payment.failureReason = err.message || "Wallet debit failed";
            await payment.save();
            throw err;
        }
    }

    // COINS
    const coinService = require("../coins/service");
    const coinsRequired = fee.coinsRequired;

    const payment = await Payment.create({
        user: userId,
        purpose: PAYMENT_PURPOSES.MANDATE_CREATE,
        method,
        amount,
        currency: "INR",
        status: PAYMENT_STATUSES.CREATED,
        description,
        meta: {
            ...baseMeta,
            method,
            paidVia: "COINS",
            coinsRequired,
            coinConversion: fee.coinConversion,
            conversionLabel: fee.conversionLabel,
        },
    });

    try {
        const result = await coinService.debitCoins(userId, {
            amount: coinsRequired,
            description: `Mandate create — ${payment._id}`,
            referenceId: String(payment._id),
            source: "OTHER",
        });

        payment.status = PAYMENT_STATUSES.PAID;
        payment.paidAt = new Date();
        payment.referenceType = "COIN_TRANSACTION";
        payment.referenceId = String(result.transaction?.id || "");
        payment.meta = {
            ...payment.meta,
            coinsDebited: coinsRequired,
            coinTransactionId: String(result.transaction?.id || ""),
        };
        await payment.save();

        return {
            payment: formatPayment(payment),
            method,
            canCreateMandate: true,
            coins: result.wallet,
            transaction: result.transaction,
            coinsDebited: coinsRequired,
            message:
                "Coin payment successful. Use paymentId with POST /api/mandates",
        };
    } catch (err) {
        payment.status = PAYMENT_STATUSES.FAILED;
        payment.failureReason = err.message || "Coin debit failed";
        await payment.save();
        throw err;
    }
};

const createOnlinePayment = async (userId, purpose, body = {}) => {
    const amount =
        body._amount !== undefined
            ? body._amount
            : await resolveAmount(purpose, body.amount);
    const method = body._method || "ONLINE";
    const description =
        String(body.description || "").trim() ||
        PURPOSE_LABELS[purpose] ||
        "CredAxis payment";

    const payment = await Payment.create({
        user: userId,
        purpose,
        method,
        amount,
        currency: "INR",
        status: PAYMENT_STATUSES.CREATED,
        description,
        meta: body.meta && typeof body.meta === "object" ? body.meta : {},
    });

    const receipt = buildReceipt(purpose);

    try {
        const order = await razorpayClient.createOrder({
            amountInr: amount,
            currency: "INR",
            receipt,
            notes: {
                paymentId: String(payment._id),
                purpose,
                userId: String(userId),
                method,
            },
        });

        payment.razorpayOrderId = order.id;
        payment.receipt = receipt;
        await payment.save();
    } catch (err) {
        payment.status = PAYMENT_STATUSES.FAILED;
        payment.failureReason = err.message || "Order creation failed";
        await payment.save();
        throw err;
    }

    const userRepository = require("../user/repository");
    const user = await userRepository.findById(userId);

    return {
        payment: formatPayment(payment),
        method,
        razorpay: buildCheckoutPayload(payment, user),
    };
};

const fulfillWalletTopup = async (payment) => {
    const walletService = require("../wallet/service");

    const result = await walletService.creditAfterOnlinePayment(payment.user, {
        amount: payment.amount,
        description: payment.description || "Wallet top-up",
        referenceId: String(payment._id),
        paymentId: String(payment._id),
    });

    payment.referenceType = "WALLET_TRANSACTION";
    payment.referenceId = String(result.transaction?.id || "");
    payment.status = PAYMENT_STATUSES.CONSUMED;
    payment.consumedAt = new Date();
    await payment.save();

    return {
        payment: formatPayment(payment),
        wallet: result.wallet,
        transaction: result.transaction,
        ...(result.firstTopupBonus
            ? { firstTopupBonus: result.firstTopupBonus }
            : {}),
    };
};

const fulfillCreditCheck = async (payment) => {
    // Leave PAID — credit-reports/fetch will consume this paymentId
    return {
        payment: formatPayment(payment),
        canFetch: true,
        message: "Payment verified. Use paymentId with credit-reports/fetch",
    };
};

const fulfillMandateCreate = async (payment) => {
    // Leave PAID — POST /mandates will consume this paymentId
    return {
        payment: formatPayment(payment),
        canCreateMandate: true,
        message: "Payment verified. Use paymentId with POST /api/mandates",
    };
};

const FULFILLERS = {
    [PAYMENT_PURPOSES.WALLET_TOPUP]: fulfillWalletTopup,
    [PAYMENT_PURPOSES.CREDIT_CHECK]: fulfillCreditCheck,
    [PAYMENT_PURPOSES.MANDATE_CREATE]: fulfillMandateCreate,
};

/**
 * Verify Razorpay signature and fulfill by purpose.
 */
exports.verifyPayment = async (userId, body = {}) => {
    const razorpayOrderId = String(body.razorpay_order_id || "").trim();
    const razorpayPaymentId = String(body.razorpay_payment_id || "").trim();
    const razorpaySignature = String(body.razorpay_signature || "").trim();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        throw new ApiError(
            400,
            "razorpay_order_id, razorpay_payment_id and razorpay_signature are required"
        );
    }

    const payment = await Payment.findOne({
        razorpayOrderId,
        user: userId,
    });

    if (!payment) {
        throw new ApiError(404, "Payment not found for this order");
    }

    if (
        payment.status === PAYMENT_STATUSES.PAID ||
        payment.status === PAYMENT_STATUSES.CONSUMED
    ) {
        if (payment.purpose === PAYMENT_PURPOSES.WALLET_TOPUP) {
            return {
                payment: formatPayment(payment),
                message: "Payment already verified",
            };
        }
        if (payment.purpose === PAYMENT_PURPOSES.MANDATE_CREATE) {
            return {
                payment: formatPayment(payment),
                canCreateMandate: payment.status === PAYMENT_STATUSES.PAID,
                message: "Payment already verified",
            };
        }
        return {
            payment: formatPayment(payment),
            canFetch: payment.status === PAYMENT_STATUSES.PAID,
            message: "Payment already verified",
        };
    }

    if (payment.status !== PAYMENT_STATUSES.CREATED) {
        throw new ApiError(
            400,
            `Payment cannot be verified in status ${payment.status}`
        );
    }

    razorpayClient.verifyPaymentSignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
    });

    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.status = PAYMENT_STATUSES.PAID;
    payment.paidAt = new Date();
    await payment.save();

    const fulfill = FULFILLERS[payment.purpose];
    if (!fulfill) {
        throw new ApiError(500, `No fulfiller for purpose ${payment.purpose}`);
    }

    return fulfill(payment);
};

exports.getPaymentById = async (userId, paymentId) => {
    const payment = await Payment.findOne({ _id: paymentId, user: userId });
    if (!payment) {
        throw new ApiError(404, "Payment not found");
    }
    return formatPayment(payment);
};

const consumePurposePayment = async (
    userId,
    paymentId,
    purpose,
    notFoundMessage
) => {
    if (!paymentId) {
        throw new ApiError(400, "paymentId is required");
    }

    const payment = await Payment.findOne({
        _id: paymentId,
        user: userId,
        purpose,
    });

    if (!payment) {
        throw new ApiError(404, notFoundMessage);
    }

    if (payment.status === PAYMENT_STATUSES.CONSUMED) {
        throw new ApiError(400, "This payment has already been used");
    }

    if (payment.status !== PAYMENT_STATUSES.PAID) {
        throw new ApiError(
            400,
            "Payment not verified yet. Complete payment first"
        );
    }

    const claimed = await Payment.findOneAndUpdate(
        {
            _id: payment._id,
            user: userId,
            purpose,
            status: PAYMENT_STATUSES.PAID,
        },
        {
            $set: {
                status: PAYMENT_STATUSES.CONSUMED,
                consumedAt: new Date(),
            },
        },
        { new: true }
    );

    if (!claimed) {
        throw new ApiError(400, "This payment has already been used");
    }

    return claimed;
};

/**
 * Mark a PAID CREDIT_CHECK payment as CONSUMED (used once for report fetch).
 */
exports.consumeCreditCheckPayment = async (userId, paymentId) =>
    consumePurposePayment(
        userId,
        paymentId,
        PAYMENT_PURPOSES.CREDIT_CHECK,
        "Credit check payment not found"
    );

/**
 * Mark a PAID MANDATE_CREATE payment as CONSUMED (used once for mandate create).
 */
exports.consumeMandateCreatePayment = async (userId, paymentId) =>
    consumePurposePayment(
        userId,
        paymentId,
        PAYMENT_PURPOSES.MANDATE_CREATE,
        "Mandate create payment not found"
    );

exports.attachCreditReportReference = async (paymentId, reportId) => {
    if (!paymentId || !reportId) return;
    await Payment.updateOne(
        { _id: paymentId },
        {
            $set: {
                referenceType: "CREDIT_REPORT",
                referenceId: String(reportId),
            },
        }
    );
};

exports.attachMandateReference = async (paymentId, mandateId) => {
    if (!paymentId || !mandateId) return;
    await Payment.updateOne(
        { _id: paymentId },
        {
            $set: {
                referenceType: "MANDATE",
                referenceId: String(mandateId),
            },
        }
    );
};

/** Rollback CONSUMED → PAID when create/fetch failed before linking a resource. */
exports.releaseConsumedPayment = async (paymentId) => {
    if (!paymentId) return;
    await Payment.updateOne(
        {
            _id: paymentId,
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
};

exports.PAYMENT_PURPOSES = PAYMENT_PURPOSES;
exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
