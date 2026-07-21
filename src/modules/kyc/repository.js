const BaseRepository = require("../../core/BaseRepository");
const Kyc = require("./model");

class KycRepository extends BaseRepository {
    constructor() {
        super(Kyc);
    }

    findByUserId(userId) {
        return this.findOne({ user: userId });
    }

    findByIdWithUser(id) {
        return this.model.findById(id).populate("user", "mobile email");
    }

    findPending() {
        return this.model
            .find({ status: { $in: ["PENDING", "UNDER_REVIEW"] } })
            .populate({
                path: "user",
                select: "mobile email isDeleted role",
                match: { isDeleted: false },
            })
            .sort({ createdAt: -1 })
            .then((rows) => rows.filter((row) => row.user));
    }

    /**
     * Pending KYC for active (non-deleted) users only — matches Users / KYC page.
     */
    async countPendingForActiveUsers(excludeRoleId = null) {
        const userMatch = { "userDoc.isDeleted": false };
        if (excludeRoleId) {
            userMatch["userDoc.role"] = { $ne: excludeRoleId };
        }

        const result = await this.model.aggregate([
            {
                $match: {
                    status: { $in: ["PENDING", "UNDER_REVIEW"] },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userDoc",
                },
            },
            { $unwind: "$userDoc" },
            { $match: userMatch },
            { $count: "total" },
        ]);

        return result[0]?.total || 0;
    }
}

module.exports = new KycRepository();
