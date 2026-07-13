const BaseRepository = require("../../core/BaseRepository");
const Role = require("./role.model");
const ROLES = require("../../constants/roles");

class RoleRepository extends BaseRepository {
    constructor() {
        super(Role);
    }

    findByName(name) {
        return this.findOne({ name });
    }

    getUserRole() {
        return this.findByName(ROLES.USER);
    }

    getPartnerRole() {
        return this.findByName(ROLES.PARTNER);
    }
}

module.exports = new RoleRepository();
