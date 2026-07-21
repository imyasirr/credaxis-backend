const BaseRepository = require("../../core/BaseRepository");
const Notification = require("./model");

class NotificationRepository extends BaseRepository {
    constructor() {
        super(Notification);
    }

    findByUserId(userId, { page = 1, limit = 20 } = {}) {
        return this.findByFilter({ user: userId }, { page, limit });
    }

    findByFilter(filter, { page = 1, limit = 20 } = {}) {
        const skip = (page - 1) * limit;

        return this.model
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    }

    countByUserId(userId) {
        return this.countByFilter({ user: userId });
    }

    countByFilter(filter) {
        return this.model.countDocuments(filter);
    }

    countUnread(userId) {
        return this.model.countDocuments({ user: userId, isRead: false });
    }

    findOneByUser(id, userId) {
        return this.model.findOne({ _id: id, user: userId });
    }

    markAsRead(id, userId) {
        return this.model.findOneAndUpdate(
            { _id: id, user: userId },
            { isRead: true },
            { returnDocument: "after" }
        );
    }

    markAllAsRead(userId) {
        return this.model.updateMany(
            { user: userId, isRead: false },
            { isRead: true }
        );
    }

    deleteByUser(id, userId) {
        return this.model.findOneAndDelete({ _id: id, user: userId });
    }
}

module.exports = new NotificationRepository();
