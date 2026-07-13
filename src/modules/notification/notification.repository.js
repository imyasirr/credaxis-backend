const BaseRepository = require("../../core/BaseRepository");
const Notification = require("./notification.model");

class NotificationRepository extends BaseRepository {
    constructor() {
        super(Notification);
    }

    findByUserId(userId, { page = 1, limit = 20 } = {}) {
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

    countUnread(userId) {
        return this.model.countDocuments({ user: userId, isRead: false });
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
}

module.exports = new NotificationRepository();
