const BaseRepository = require("../../core/BaseRepository");
const Referral = require("./referral.model");

class ReferralRepository extends BaseRepository {
    constructor() {
        super(Referral);
    }

    findByReferredUserId(userId) {
        return this.findOne({ referredUser: userId });
    }

    findByPartnerUserId(partnerUserId, { skip = 0, limit = 10 } = {}) {
        return this.model
            .find({ partnerUser: partnerUserId })
            .populate("referredUser", "mobile status isMobileVerified createdAt")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    }

    countByPartnerUserId(partnerUserId) {
        return this.model.countDocuments({ partnerUser: partnerUserId });
    }

    countByPartnerUserIdAndStatus(partnerUserId, status) {
        return this.model.countDocuments({ partnerUser: partnerUserId, status });
    }
}

module.exports = new ReferralRepository();
