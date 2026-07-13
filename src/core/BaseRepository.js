class BaseRepository {
    constructor(model) {
        this.model = model;
    }

    // Always returns a single document, even inside a transaction
    // (Model.create with a session requires the array form).
    async create(data, session = null) {
        if (session) {
            const docs = await this.model.create([data], { session });
            return docs[0];
        }

        return this.model.create(data);
    }

    find(filter = {}) {
        return this.model.find(filter);
    }

    findById(id) {
        return this.model.findById(id);
    }

    findOne(filter) {
        return this.model.findOne(filter);
    }

    update(id, data) {
        return this.model.findByIdAndUpdate(id, data, {
            new: true,
        });
    }

    delete(id) {
        return this.model.findByIdAndDelete(id);
    }
}

module.exports = BaseRepository;
