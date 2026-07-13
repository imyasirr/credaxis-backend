const BaseRepository = require("../../core/BaseRepository");
const Otp = require("./otp.model");

class OtpRepository extends BaseRepository {
    constructor() {
        super(Otp);
    }

    invalidatePending(mobile, purpose) {
        return this.model.updateMany(
            { mobile, purpose, isVerified: false },
            { isVerified: true }
        );
    }

    findValid(mobile, purpose) {
        return this.model.findOne({
            mobile,
            purpose,
            isVerified: false,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });
    }
}

module.exports = new OtpRepository();
