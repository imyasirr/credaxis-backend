const BaseRepository = require("../../core/BaseRepository");
const Partner = require("./partner.model");

class PartnerRepository extends BaseRepository {
    constructor() {
        super(Partner);
    }

    findByUserId(userId) {
        return this.findOne({ user: userId });
    }

    findByPartnerCode(partnerCode) {
        return this.findOne({
            partnerCode: partnerCode.toUpperCase(),
            status: "APPROVED",
        });
    }

    findByStatus(status) {
        return this.model
            .find(status ? { status } : {})
            .populate("user", "mobile status")
            .sort({ createdAt: -1 });
    }

    incrementReferrals(partnerId) {
        return this.model.findByIdAndUpdate(
            partnerId,
            { $inc: { totalReferrals: 1 } },
            { returnDocument: "after" }
        );
    }
}

module.exports = new PartnerRepository();
