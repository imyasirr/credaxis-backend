const Payment = require("./model");
const razorpayClient = require("../../../integrations/razorpay/razorpay.client");
const {
    PAYMENT_PURPOSES,
    PAYMENT_STATUSES,
} = require("../../../integrations/razorpay/constants");
const { formatPayment } = require("./mapper");
const creditCheckFeeService = require("./creditCheckFee.service");
const ApiError = require("../../../utils/ApiError");

const PURPOSE_LABELS = {
    [PAYMENT_PURPOSES.WALLET_TOPUP]: "Wallet top-up",
    [PAYMENT_PURPOSES.CREDIT_CHECK]: "Credit score check",
};

const buildReceipt = (purpose) =>
    `${String(purpose).slice(0, 8)}_${Date.now().toString().slice(-8)}`;

const resolveAmount = async (purpose, amount) => {
    if (purpose === PAYMENT_PURPOSES.CREDIT_CHECK) {
        return creditCheckFeeService.resolveCreditCheckAmount();
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
 * Create Razorpay order + local Payment row.
 * Reusable for WALLET_TOPUP | CREDIT_CHECK (add more purposes later).
 */
exports.createPayment = async (userId, body = {}) => {
    const purpose = String(body.purpose || "").toUpperCase();

    if (!Object.values(PAYMENT_PURPOSES).includes(purpose)) {
        throw new ApiError(
            400,
            `purpose must be one of: ${Object.values(PAYMENT_PURPOSES).join(", ")}`
        );
    }

    const amount = await resolveAmount(purpose, body.amount);
    const description =
        String(body.description || "").trim() ||
        PURPOSE_LABELS[purpose] ||
        "CredAxis payment";

    const payment = await Payment.create({
        user: userId,
        purpose,
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

const FULFILLERS = {
    [PAYMENT_PURPOSES.WALLET_TOPUP]: fulfillWalletTopup,
    [PAYMENT_PURPOSES.CREDIT_CHECK]: fulfillCreditCheck,
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

/**
 * Mark a PAID CREDIT_CHECK payment as CONSUMED (used once for report fetch).
 */
exports.consumeCreditCheckPayment = async (userId, paymentId) => {
    if (!paymentId) {
        throw new ApiError(400, "paymentId is required");
    }

    const payment = await Payment.findOne({
        _id: paymentId,
        user: userId,
        purpose: PAYMENT_PURPOSES.CREDIT_CHECK,
    });

    if (!payment) {
        throw new ApiError(404, "Credit check payment not found");
    }

    if (payment.status === PAYMENT_STATUSES.CONSUMED) {
        throw new ApiError(400, "This payment has already been used");
    }

    if (payment.status !== PAYMENT_STATUSES.PAID) {
        throw new ApiError(
            400,
            "Payment not verified yet. Complete Razorpay payment first"
        );
    }

    // Atomic claim
    const claimed = await Payment.findOneAndUpdate(
        {
            _id: payment._id,
            user: userId,
            purpose: PAYMENT_PURPOSES.CREDIT_CHECK,
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

exports.PAYMENT_PURPOSES = PAYMENT_PURPOSES;
exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
