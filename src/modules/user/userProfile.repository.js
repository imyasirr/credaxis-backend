const BaseRepository = require("../../core/BaseRepository");
const UserProfile = require("./userProfile.model");

class UserProfileRepository extends BaseRepository {
    constructor() {
        super(UserProfile);
    }

    findByUserId(userId) {
        return this.findOne({ user: userId });
    }

    updateByUserId(userId, data) {
        return this.model.findOneAndUpdate({ user: userId }, data, {
            returnDocument: "after",
        });
    }
}

module.exports = new UserProfileRepository();
