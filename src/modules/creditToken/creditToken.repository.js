const BaseRepository = require("../../core/BaseRepository");
const CreditToken = require("./creditToken.model");

class CreditTokenRepository extends BaseRepository {
    constructor() {
        super(CreditToken);
    }
}

module.exports = new CreditTokenRepository();
