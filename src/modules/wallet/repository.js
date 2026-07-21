const BaseRepository = require("../../core/BaseRepository");
const Wallet = require("./model");

class WalletRepository extends BaseRepository {
    constructor() {
        super(Wallet);
    }

    findByUserId(userId) {
        return this.findOne({ user: userId });
    }
}

module.exports = new WalletRepository();
