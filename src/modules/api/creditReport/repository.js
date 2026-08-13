const BaseRepository = require("../../../core/BaseRepository");
const CreditReport = require("./model");

class CreditReportRepository extends BaseRepository {
    constructor() {
        super(CreditReport);
    }

    findByReferenceId(referenceId) {
        return this.findOne({ referenceId });
    }

    /**
     * Same subject for a checklist owner + same bureau/provider.
     * Match: user + pan + mobile + provider (name preferred when several).
     * userId null → external/admin checks with no linked user.
     * Different providers never overwrite each other.
     */
    async findBySubjectIdentity({
        pan,
        mobile,
        name,
        userId = null,
        provider = "EQUIFAX",
    }) {
        const filter = {
            pan: String(pan || "")
                .trim()
                .toUpperCase(),
            mobile: String(mobile || "").trim(),
            provider: String(provider || "EQUIFAX")
                .trim()
                .toUpperCase(),
        };

        if (userId) {
            filter.user = userId;
        } else {
            filter.$or = [{ user: null }, { user: { $exists: false } }];
        }

        const candidates = await this.model
            .find(filter)
            .sort({ updatedAt: -1 })
            .limit(30);

        if (!candidates.length) return null;

        const key = String(name || "")
            .trim()
            .replace(/\s+/g, " ")
            .toUpperCase();

        if (key) {
            const nameMatch = candidates.find((doc) => {
                const docKey = String(doc.name || "")
                    .trim()
                    .replace(/\s+/g, " ")
                    .toUpperCase();
                return docKey === key;
            });
            if (nameMatch) return nameMatch;
        }

        // Same user + PAN + mobile + provider → one subject per bureau
        return candidates[0];
    }

    findAdminById(id) {
        return this.model
            .findById(id)
            .populate("user", "mobile email status")
            .populate("checkedBy", "mobile email status");
    }

    findByUserId(userId, { limit = 20 } = {}) {
        return this.model
            .find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select("-rawResponse -requestPayload");
    }

    findLatestByUserId(userId) {
        return this.model
            .findOne({ user: userId, status: "SUCCESS" })
            .sort({ createdAt: -1 });
    }

    async listAdmin(filter = {}, { page = 1, limit = 20 } = {}) {
        const skip = (page - 1) * limit;
        const query = this.model
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("user", "mobile email status")
            .populate("checkedBy", "mobile email status")
            .select("-rawResponse -requestPayload");

        const [items, total] = await Promise.all([
            query,
            this.model.countDocuments(filter),
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }

    /**
     * Everything related to a user for admin:
     * - checks they own (their checklist, including OTHER subjects)
     * - checks run against their mobile (by admin / others)
     */
    async listForUserAdmin(userId, mobile, { page = 1, limit = 20 } = {}) {
        const skip = (page - 1) * limit;
        const filter = {
            $or: [{ user: userId }, ...(mobile ? [{ mobile }] : [])],
        };

        const query = this.model
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("user", "mobile email status")
            .populate("checkedBy", "mobile email status")
            .select("-rawResponse -requestPayload");

        const [items, total] = await Promise.all([
            query,
            this.model.countDocuments(filter),
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }
}

module.exports = new CreditReportRepository();
