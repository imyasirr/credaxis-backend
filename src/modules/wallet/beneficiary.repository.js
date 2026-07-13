const BaseRepository = require("../../core/BaseRepository");
const Beneficiary = require("./beneficiary.model");

class BeneficiaryRepository extends BaseRepository {
    constructor() {
        super(Beneficiary);
    }

    findByUserId(userId) {
        return this.model.find({ user: userId, status: "ACTIVE" }).sort({
            createdAt: -1,
        });
    }

    findByIdAndUserId(id, userId) {
        return this.findOne({ _id: id, user: userId });
    }
}

module.exports = new BeneficiaryRepository();
