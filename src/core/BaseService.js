class BaseService {
    constructor(repository) {
        this.repository = repository;
    }

    create(data, session) {
        return this.repository.create(data, session);
    }

    getAll(filter = {}) {
        return this.repository.find(filter);
    }

    getById(id) {
        return this.repository.findById(id);
    }

    update(id, data) {
        return this.repository.update(id, data);
    }

    delete(id) {
        return this.repository.delete(id);
    }
}

module.exports = BaseService;
