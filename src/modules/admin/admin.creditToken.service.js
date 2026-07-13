const CreditToken = require("../creditToken/creditToken.model");
const { formatCreditToken } = require("../creditToken/creditToken.mapper");
const ApiError = require("../../utils/ApiError");

const TOKEN_TYPES = ["CRIF", "CIBIL", "EXPERIAN"];

const SORTABLE_FIELDS = {
    title: "title",
    price: "price",
    quantity: "quantity",
    tokenType: "tokenType",
    planType: "planType",
    status: "status",
    sortOrder: "sortOrder",
    createdAt: "createdAt",
};

exports.getTokenTypes = () => TOKEN_TYPES;

exports.getTokens = async (query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.status) {
        filter.status = query.status;
    }

    if (query.tokenType) {
        filter.tokenType = query.tokenType;
    }

    if (query.planType) {
        filter.planType = query.planType;
    }

    if (query.search) {
        const search = query.search.trim();
        filter.$or = [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { badge: { $regex: search, $options: "i" } },
        ];
    }

    const sortField =
        SORTABLE_FIELDS[query.sortBy] || SORTABLE_FIELDS.sortOrder;
    const sortDir = query.sortOrder === "desc" ? -1 : 1;

    const [tokens, total] = await Promise.all([
        CreditToken.find(filter)
            .sort({ [sortField]: sortDir, createdAt: -1 })
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

exports.getTokenById = async (tokenId) => {
    const token = await CreditToken.findById(tokenId);

    if (!token) {
        throw new ApiError(404, "Token not found");
    }

    return formatCreditToken(token);
};

exports.createToken = async (adminId, body) => {
    const token = await CreditToken.create({
        title: body.title.trim(),
        description: body.description?.trim() || "",
        tokenType: body.tokenType,
        planType: body.planType || "NORMAL",
        badge: body.badge?.trim() || "",
        price: Number(body.price),
        quantity: Number(body.quantity),
        status: body.status || "ACTIVE",
        sortOrder: Number(body.sortOrder) || 0,
        createdBy: adminId,
    });

    return formatCreditToken(token);
};

exports.updateToken = async (tokenId, body) => {
    const token = await CreditToken.findById(tokenId);

    if (!token) {
        throw new ApiError(404, "Token not found");
    }

    if (body.title !== undefined) token.title = body.title.trim();
    if (body.description !== undefined) {
        token.description = body.description.trim();
    }
    if (body.tokenType !== undefined) token.tokenType = body.tokenType;
    if (body.planType !== undefined) token.planType = body.planType;
    if (body.badge !== undefined) token.badge = body.badge.trim();
    if (body.price !== undefined) token.price = Number(body.price);
    if (body.quantity !== undefined) token.quantity = Number(body.quantity);
    if (body.status !== undefined) token.status = body.status;
    if (body.sortOrder !== undefined) token.sortOrder = Number(body.sortOrder);

    await token.save();

    return formatCreditToken(token);
};

exports.deleteToken = async (tokenId) => {
    const token = await CreditToken.findByIdAndDelete(tokenId);

    if (!token) {
        throw new ApiError(404, "Token not found");
    }

    return {
        id: token._id,
        title: token.title,
    };
};
