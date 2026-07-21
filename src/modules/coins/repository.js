const BaseRepository = require("../../core/BaseRepository");
const CoinWallet = require("./model");

class CoinWalletRepository extends BaseRepository {
    constructor() {
        super(CoinWallet);
    }

    findByUserId(userId) {
        return this.findOne({ user: userId });
    }
}

module.exports = new CoinWalletRepository();
