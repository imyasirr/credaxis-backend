const BaseRepository = require("../../core/BaseRepository");
const Otp = require("./otp.model");

class OtpRepository extends BaseRepository {
    constructor() {
        super(Otp);
    }

    findLatest(mobile, purpose) {
        return this.model
            .findOne({ mobile, purpose })
            .sort({ updatedAt: -1, createdAt: -1 });
    }

    findValid(mobile, purpose) {
        return this.model
            .findOne({
                mobile,
                purpose,
                isVerified: false,
                expiresAt: { $gt: new Date() },
            })
            .sort({ updatedAt: -1, createdAt: -1 });
    }

    /**
     * Keep a single OTP row per mobile+purpose — update in place (upsert).
     * Removes any older duplicate rows for the same mobile+purpose.
     */
    async upsertOtp({ userId, mobile, purpose, otp, expiresAt }) {
        const existing = await this.findLatest(mobile, purpose);

        let record;

        if (existing) {
            existing.user = userId || existing.user || null;
            existing.otp = otp;
            existing.expiresAt = expiresAt;
            existing.isVerified = false;
            existing.attempts = 0;
            existing.lastSentAt = new Date();
            await existing.save();
            record = existing;

            await this.model.deleteMany({
                mobile,
                purpose,
                _id: { $ne: existing._id },
            });
        } else {
            record = await this.create({
                user: userId,
                mobile,
                purpose,
                otp,
                expiresAt,
                isVerified: false,
                attempts: 0,
                lastSentAt: new Date(),
            });
        }

        return record;
    }
}

module.exports = new OtpRepository();
