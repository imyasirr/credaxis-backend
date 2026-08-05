const mongoose = require("mongoose");

const DELETION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

const accountDeletionRequestSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        reason: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
        },

        status: {
            type: String,
            enum: DELETION_STATUSES,
            default: "PENDING",
            index: true,
        },

        adminRemarks: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
        },

        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        processedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

accountDeletionRequestSchema.index(
    { user: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "PENDING" },
    }
);

module.exports = mongoose.model(
    "AccountDeletionRequest",
    accountDeletionRequestSchema
);
module.exports.DELETION_STATUSES = DELETION_STATUSES;
