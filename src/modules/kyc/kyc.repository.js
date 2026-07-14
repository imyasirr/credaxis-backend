const BaseRepository = require("../../core/BaseRepository");
const Kyc = require("./kyc.model");

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
            .populate("user", "mobile email")
            .sort({ createdAt: -1 });
    }
}

module.exports = new KycRepository();
