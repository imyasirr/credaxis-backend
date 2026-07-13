const CreditToken = require("./creditToken.model");
const TokenPurchase = require("./tokenPurchase.model");
const { formatTokenPurchase } = require("./tokenPurchase.mapper");
const ApiError = require("../../utils/ApiError");

const generateTransactionId = () =>
    `TP${Date.now()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;

exports.createPurchase = async (userId, body) => {
    const plan = await CreditToken.findById(body.tokenPlanId);

    if (!plan || plan.status !== "ACTIVE") {
        throw new ApiError(404, "Token plan not found or inactive");
    }

    const purchase = await TokenPurchase.create({
        user: userId,
        tokenPlan: plan._id,
        planTitle: plan.title,
        tokenType: plan.tokenType,
        quantity: plan.quantity,
        price: plan.price,
        planType: plan.planType,
        paymentMethod: body.paymentMethod || "WALLET",
        transactionId: body.transactionId || generateTransactionId(),
        status: body.status || "SUCCESS",
        purchasedAt: new Date(),
    });

    return formatTokenPurchase(purchase);
};

exports.getUserPurchases = async (userId, query = {}) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 15;
    const skip = (page - 1) * limit;
    const filter = { user: userId };

    if (query.tokenType) filter.tokenType = query.tokenType;
    if (query.status) filter.status = query.status;

    const [purchases, total] = await Promise.all([
        TokenPurchase.find(filter)
            .sort({ purchasedAt: -1 })
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
