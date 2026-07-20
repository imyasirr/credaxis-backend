const BaseRepository = require("../../core/BaseRepository");
const User = require("./user.model");

class UserRepository extends BaseRepository {
    constructor() {
        super(User);
    }

    findByEmail(email) {
        return this.findOne({ email, isDeleted: false });
    }

    findByMobile(mobile) {
        return this.findOne({ mobile, isDeleted: false });
    }

    findDeletedByMobile(mobile) {
        return this.findOne({ mobile, isDeleted: true });
    }

    /**
     * Soft-deleted rows keep unique mobile/email occupied unless released.
     * Rename identity fields so the same mobile can register again.
     */
    async releaseDeletedIdentity(user) {
        if (!user || !user.isDeleted) return user;

        const prefix = `deleted_${user._id}_`;
        if (user.mobile && !String(user.mobile).startsWith("deleted_")) {
            user.mobile = prefix + user.mobile;
        }
        if (user.email && !String(user.email).startsWith("deleted_")) {
            user.email = prefix + user.email;
        }
        await user.save();
        return user;
    }
}

module.exports = new UserRepository();
