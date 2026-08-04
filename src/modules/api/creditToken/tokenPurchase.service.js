const mongoose = require("mongoose");

const CreditToken = require("./model");
const TokenPurchase = require("./tokenPurchase.model");
const Partner = require("../partner/model");
const walletService = require("../wallet/service");
const notificationService = require("../notification/service");
const { creditPartnerBalance } = require("./tokenTransfer.service");
const { formatCreditToken } = require("./mapper");
const { formatTokenPurchase } = require("./tokenPurchase.mapper");
const ApiError = require("../../../utils/ApiError");

const generateTransactionId = () =>
    `TP${Date.now()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;

const getApprovedPartner = async (userId) => {
    const partner = await Partner.findOne({ user: userId });

    if (!partner || partner.status !== "APPROVED") {
        throw new ApiError(403, "Approved partner access only");
    }

    return partner;
};

const getActivePlan = async (tokenPlanId) => {
    const plan = await CreditToken.findById(tokenPlanId);

    if (!plan || plan.status !== "ACTIVE") {
        throw new ApiError(404, "Token plan not found or inactive");
    }

    return plan;
};

const buildPurchaseDoc = (userId, partnerId, plan, paymentMethod, extras = {}) => ({
    user: userId,
    partner: partnerId,
    tokenPlan: plan._id,
    planTitle: plan.title,
    tokenType: plan.tokenType,
    quantity: plan.quantity,
    price: plan.price,
    planType: plan.planType,
    paymentMethod,
    transactionId: extras.transactionId || generateTransactionId(),
    status: extras.status || "SUCCESS",
    purchasedAt: extras.purchasedAt || new Date(),
    walletTransaction: extras.walletTransaction || null,
    razorpayOrderId: extras.razorpayOrderId || null,
    razorpayPaymentId: extras.razorpayPaymentId || null,
    razorpaySignature: extras.razorpaySignature || null,
    failureReason: extras.failureReason || "",
});

/** Active token plans catalog for partners. */
exports.getActivePlans = async (query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;
    const filter = { status: "ACTIVE" };

    if (query.tokenType) filter.tokenType = query.tokenType;
    if (query.planType) filter.planType = query.planType;

    const [tokens, total] = await Promise.all([
        CreditToken.find(filter)
            .sort({ sortOrder: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit),
        CreditToken.countDocuments(filter),
    ]);

    return {
        tokens: tokens.map(formatCreditToken),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

/** Wallet purchase — debit wallet, credit partner token balance. */
exports.purchaseWithWallet = async (userId, { tokenPlanId }) => {
    const partner = await getApprovedPartner(userId);
    const plan = await getActivePlan(tokenPlanId);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const purchaseId = new mongoose.Types.ObjectId();
        const purchaseTxnId = generateTransactionId();

        const { wallet, transaction, transactionDoc } =
            await walletService.debitMoney(
                userId,
                {
                    amount: plan.price,
                    description: `Token purchase: ${plan.title} (${plan.quantity} ${plan.tokenType})`,
                    referenceId: purchaseTxnId,
                },
                session
            );

        await creditPartnerBalance(
            partner._id,
            partner.user,
            plan.tokenType,
            plan.quantity,
            session
        );

        const [purchase] = await TokenPurchase.create(
            [
                {
                    _id: purchaseId,
                    ...buildPurchaseDoc(userId, partner._id, plan, "WALLET", {
                        transactionId: purchaseTxnId,
                        status: "SUCCESS",
                        walletTransaction: transactionDoc._id,
                    }),
                },
            ],
            { session }
        );

        await session.commitTransaction();

        await notificationService.notifySafe(userId, {
            title: "Tokens purchased",
            message: `${plan.quantity} ${plan.tokenType} tokens added to your balance`,
            type: "SUCCESS",
        });

        return {
            purchase: formatTokenPurchase(purchase),
            wallet,
            walletTransaction: transaction,
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

/**
 * Online / Razorpay order via shared Razorpay client.
 */
exports.createOnlineOrder = async (userId, { tokenPlanId }) => {
    const partner = await getApprovedPartner(userId);
    const plan = await getActivePlan(tokenPlanId);
    const purchaseTxnId = generateTransactionId();
    const razorpayClient = require("../../../integrations/razorpay/razorpay.client");

    const purchase = await TokenPurchase.create(
        buildPurchaseDoc(userId, partner._id, plan, "ONLINE", {
            transactionId: purchaseTxnId,
            status: "PENDING",
            purchasedAt: null,
        })
    );

    try {
        const order = await razorpayClient.createOrder({
            amountInr: plan.price,
            currency: "INR",
            receipt: `TP_${String(purchase._id).slice(-10)}`,
            notes: {
                purchaseId: String(purchase._id),
                transactionId: purchaseTxnId,
                partnerId: String(partner._id),
                purpose: "TOKEN_PURCHASE",
            },
        });

        purchase.razorpayOrderId = order.id;
        await purchase.save();

        return {
            purchase: formatTokenPurchase(purchase),
            razorpay: {
                ready: true,
                key: razorpayClient.getPublicKey(),
                orderId: order.id,
                amount: Math.round(plan.price * 100),
                currency: "INR",
                name: "CredAxis",
                description: `${plan.title} — ${plan.quantity} ${plan.tokenType} tokens`,
                notes: {
                    purchaseId: purchase._id.toString(),
                    transactionId: purchaseTxnId,
                    partnerId: partner._id.toString(),
                },
            },
        };
    } catch (err) {
        purchase.status = "FAILED";
        purchase.failureReason = err.message || "Order creation failed";
        await purchase.save();
        throw err;
    }
};

/**
 * Unified entry: WALLET (live) | ONLINE (stub order).
 */
exports.purchaseTokens = async (userId, body) => {
    const method = String(body.paymentMethod || "WALLET").toUpperCase();

    if (method === "WALLET") {
        return exports.purchaseWithWallet(userId, body);
    }

    if (method === "ONLINE") {
        return exports.createOnlineOrder(userId, body);
    }

    throw new ApiError(400, "paymentMethod must be WALLET or ONLINE");
};

/**
 * Verify Razorpay payment and credit partner tokens.
 */
exports.verifyOnlinePayment = async (userId, purchaseId, payload = {}) => {
    const partner = await getApprovedPartner(userId);
    const purchase = await TokenPurchase.findOne({
        _id: purchaseId,
        user: userId,
        partner: partner._id,
    });

    if (!purchase) {
        throw new ApiError(404, "Purchase not found");
    }

    if (purchase.paymentMethod !== "ONLINE") {
        throw new ApiError(400, "Only online purchases can be verified");
    }

    if (purchase.status === "SUCCESS") {
        return {
            purchase: formatTokenPurchase(purchase),
            message: "Payment already verified",
        };
    }

    const razorpayOrderId = String(
        payload.razorpay_order_id || purchase.razorpayOrderId || ""
    ).trim();
    const razorpayPaymentId = String(
        payload.razorpay_payment_id || ""
    ).trim();
    const razorpaySignature = String(
        payload.razorpay_signature || ""
    ).trim();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        throw new ApiError(
            400,
            "razorpay_order_id, razorpay_payment_id and razorpay_signature are required"
        );
    }

    if (
        purchase.razorpayOrderId &&
        purchase.razorpayOrderId !== razorpayOrderId
    ) {
        throw new ApiError(400, "Order id does not match this purchase");
    }

    const razorpayClient = require("../../../integrations/razorpay/razorpay.client");
    razorpayClient.verifyPaymentSignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await creditPartnerBalance(
            partner._id,
            partner.user,
            purchase.tokenType,
            purchase.quantity,
            session
        );

        purchase.status = "SUCCESS";
        purchase.purchasedAt = new Date();
        purchase.razorpayOrderId = razorpayOrderId;
        purchase.razorpayPaymentId = razorpayPaymentId;
        purchase.razorpaySignature = razorpaySignature;
        purchase.failureReason = "";
        await purchase.save({ session });

        await session.commitTransaction();

        await notificationService.notifySafe(userId, {
            title: "Tokens purchased",
            message: `${purchase.quantity} ${purchase.tokenType} tokens added to your balance`,
            type: "SUCCESS",
        });

        return {
            purchase: formatTokenPurchase(purchase),
            message: "Payment verified successfully",
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

exports.getUserPurchases = async (userId, query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 15;
    const skip = (page - 1) * limit;
    const filter = { user: userId };

    if (query.tokenType) filter.tokenType = query.tokenType;
    if (query.status) filter.status = query.status;
    if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;

    const [purchases, total] = await Promise.all([
        TokenPurchase.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        TokenPurchase.countDocuments(filter),
    ]);

    return {
        purchases: purchases.map((item) => formatTokenPurchase(item)),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.getPurchaseById = async (userId, purchaseId) => {
    const purchase = await TokenPurchase.findOne({
        _id: purchaseId,
        user: userId,
    });

    if (!purchase) {
        throw new ApiError(404, "Purchase not found");
    }

    return formatTokenPurchase(purchase);
};

/** @deprecated Prefer purchaseTokens — kept for any legacy callers */
exports.createPurchase = async (userId, body) => {
    return exports.purchaseTokens(userId, body);
};
