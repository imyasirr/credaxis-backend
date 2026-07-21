const BaseRepository = require("../../core/BaseRepository");
const CreditToken = require("./model");

class CreditTokenRepository extends BaseRepository {
    constructor() {
        super(CreditToken);
    }
}

module.exports = new CreditTokenRepository();
