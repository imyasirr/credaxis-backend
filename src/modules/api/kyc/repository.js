const BaseRepository = require("../../../core/BaseRepository");
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
                select: "mobile email isDeleted role createdAt",
                match: { isDeleted: false },
            })
            .sort({ createdAt: -1 })
            .then((rows) => rows.filter((row) => row.user));
    }

    /**
     * Active non-admin users who have never created a KYC record.
     */
    async findUsersWithoutKyc(excludeRoleId = null) {
        const User = require("../user/model");
        const submittedUserIds = await this.model.distinct("user");
        const filter = {
            isDeleted: false,
            _id: { $nin: submittedUserIds },
        };

        if (excludeRoleId) {
            filter.role = { $ne: excludeRoleId };
        }

        return User.find(filter)
            .select("mobile email createdAt role")
            .sort({ createdAt: -1 });
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
