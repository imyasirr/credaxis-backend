const WheelPrize = require("../rewards/wheelPrize.model");
const { formatWheelPrize } = require("../rewards/wheelPrize.mapper");
const ApiError = require("../../utils/ApiError");

const PRIZE_TYPES = ["CASH", "TOKEN", "COUPON", "NO_PRIZE"];

const SORTABLE_FIELDS = {
    title: "title",
    prizeType: "prizeType",
    value: "value",
    frequency: "frequency",
    status: "status",
    sortOrder: "sortOrder",
    createdAt: "createdAt",
};

exports.getPrizeTypes = () => PRIZE_TYPES;

exports.getPrizes = async (query) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.status) {
        filter.status = query.status;
    }

    if (query.prizeType) {
        filter.prizeType = query.prizeType;
    }

    if (query.search) {
        const search = query.search.trim();
        filter.$or = [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
        ];
    }

    const sortField =
        SORTABLE_FIELDS[query.sortBy] || SORTABLE_FIELDS.sortOrder;
    const sortDir = query.sortOrder === "desc" ? -1 : 1;

    const [prizes, total, allActivePrizes] = await Promise.all([
        WheelPrize.find(filter)
            .sort({ [sortField]: sortDir, createdAt: -1 })
            .skip(skip)
            .limit(limit),
        WheelPrize.countDocuments(filter),
        WheelPrize.find({ status: "ACTIVE" }).select("frequency status"),
    ]);

    const activeTotal = allActivePrizes.reduce(
        (sum, prize) => sum + Number(prize.frequency || 0),
        0
    );

    const formattedPrizes = prizes.map((prize) => {
        const frequency = Number(prize.frequency || 0);
        const probability =
            prize.status === "ACTIVE" && activeTotal > 0
                ? Number(((frequency / activeTotal) * 100).toFixed(1))
                : 0;

        return formatWheelPrize(prize, probability);
    });

    return {
        prizes: formattedPrizes,
        totalFrequency: activeTotal,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.getPrizeById = async (prizeId) => {
    const prize = await WheelPrize.findById(prizeId);

    if (!prize) {
        throw new ApiError(404, "Wheel prize not found");
    }

    const activeTotal = await WheelPrize.aggregate([
        { $match: { status: "ACTIVE" } },
        { $group: { _id: null, total: { $sum: "$frequency" } } },
    ]);

    const total = activeTotal[0]?.total || 0;
    const frequency = Number(prize.frequency || 0);
    const probability =
        prize.status === "ACTIVE" && total > 0
            ? Number(((frequency / total) * 100).toFixed(1))
            : 0;

    return formatWheelPrize(prize, probability);
};

exports.createPrize = async (adminId, body) => {
    const prize = await WheelPrize.create({
        title: body.title.trim(),
        description: body.description?.trim() || "",
        prizeType: body.prizeType,
        value: Number(body.value) || 0,
        frequency: Number(body.frequency),
        color: body.color?.trim() || "#6366f1",
        status: body.status || "ACTIVE",
        sortOrder: Number(body.sortOrder) || 0,
        expiryDays:
            body.expiryDays !== undefined ? Number(body.expiryDays) : 30,
        createdBy: adminId,
    });

    return exports.getPrizeById(prize._id);
};

exports.updatePrize = async (prizeId, body) => {
    const prize = await WheelPrize.findById(prizeId);

    if (!prize) {
        throw new ApiError(404, "Wheel prize not found");
    }

    if (body.title !== undefined) prize.title = body.title.trim();
    if (body.description !== undefined) {
        prize.description = body.description.trim();
    }
    if (body.prizeType !== undefined) prize.prizeType = body.prizeType;
    if (body.value !== undefined) prize.value = Number(body.value);
    if (body.frequency !== undefined) prize.frequency = Number(body.frequency);
    if (body.color !== undefined) prize.color = body.color.trim();
    if (body.status !== undefined) prize.status = body.status;
    if (body.sortOrder !== undefined) prize.sortOrder = Number(body.sortOrder);
    if (body.expiryDays !== undefined) prize.expiryDays = Number(body.expiryDays);

    await prize.save();

    return exports.getPrizeById(prize._id);
};

exports.deletePrize = async (prizeId) => {
    const prize = await WheelPrize.findByIdAndDelete(prizeId);

    if (!prize) {
        throw new ApiError(404, "Wheel prize not found");
    }

    return {
        id: prize._id,
        title: prize.title,
    };
};
