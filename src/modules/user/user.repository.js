const BaseRepository = require("../../core/BaseRepository");
const User = require("./user.model");

class UserRepository extends BaseRepository {
    constructor() {
        super(User);
    }

    findByEmail(email) {
        return this.findOne({ email });
    }

    findByMobile(mobile) {
        return this.findOne({ mobile });
    }
}

module.exports = new UserRepository();
