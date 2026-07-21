const BaseRepository = require("../../core/BaseRepository");
const CoinTransaction = require("./transaction.model");

class CoinTransactionRepository extends BaseRepository {
    constructor() {
        super(CoinTransaction);
    }

    findByUserId(userId, { page = 1, limit = 10 } = {}) {
        const skip = (page - 1) * limit;

        return this.model
            .find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    }

    countByUserId(userId) {
        return this.model.countDocuments({ user: userId });
    }
}

module.exports = new CoinTransactionRepository();
