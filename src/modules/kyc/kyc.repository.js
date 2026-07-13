const BaseRepository = require("../../core/BaseRepository");
const Kyc = require("./kyc.model");

class KycRepository extends BaseRepository {
    constructor() {
        super(Kyc);
    }

    findByUserId(userId) {
        return this.findOne({ user: userId });
    }

    findPending() {
        return this.model
            .find({ status: { $in: ["PENDING", "UNDER_REVIEW"] } })
            .populate("user", "mobile")
            .sort({ createdAt: -1 });
    }
}

module.exports = new KycRepository();
