const mongoose = require("mongoose");

const CreditToken = require("./creditToken.model");
const TokenPurchase = require("./tokenPurchase.model");
const Partner = require("../partner/partner.model");
const walletService = require("../wallet/wallet.service");
const notificationService = require("../notification/notification.service");
const { creditPartnerBalance } = require("./tokenTransfer.service");
const { formatCreditToken } = require("./creditToken.mapper");
const { formatTokenPurchase } = require("./tokenPurchase.mapper");
const ApiError = require("../../utils/ApiError");

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

        await notificationService.create(userId, {
            title: "Tokens Purchased",
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
 * Online / Razorpay order stub.
 * Creates a PENDING purchase. Razorpay SDK wiring comes later.
 */
exports.createOnlineOrder = async (userId, { tokenPlanId }) => {
    const partner = await getApprovedPartner(userId);
    const plan = await getActivePlan(tokenPlanId);
    const purchaseTxnId = generateTransactionId();

    const purchase = await TokenPurchase.create(
        buildPurchaseDoc(userId, partner._id, plan, "ONLINE", {
            transactionId: purchaseTxnId,
            status: "PENDING",
            purchasedAt: null,
        })
    );

    return {
        purchase: formatTokenPurchase(purchase),
        razorpay: {
            ready: false,
            message:
                "Razorpay online payment will be available soon. Please use wallet for now.",
            // Future fields when integrated:
            // key: process.env.RAZORPAY_KEY_ID,
            // orderId: razorpayOrder.id,
            amount: Math.round(plan.price * 100), // paise
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
 * Razorpay verify stub — will confirm payment + credit tokens later.
 */
exports.verifyOnlinePayment = async (userId, purchaseId, _payload = {}) => {
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

    throw new ApiError(
        501,
        "Razorpay payment verification is not implemented yet. Use wallet purchase for now."
    );
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
