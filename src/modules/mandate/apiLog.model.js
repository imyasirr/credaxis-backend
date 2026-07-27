const mongoose = require("mongoose");
const { API_LOG_STATUS } = require("./constants");

const apiLogSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },

        apiName: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },

        method: {
            type: String,
            trim: true,
            default: null,
        },

        path: {
            type: String,
            trim: true,
            default: null,
        },

        request: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        response: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        statusCode: {
            type: Number,
            default: null,
            index: true,
        },

        status: {
            type: String,
            enum: API_LOG_STATUS,
            default: "SUCCESS",
            index: true,
        },

        ipAddress: {
            type: String,
            default: null,
            index: true,
        },

        error: {
            type: String,
            default: null,
        },

        rocketpayMandateId: {
            type: String,
            default: null,
            index: true,
        },

        rocketpayInstallmentId: {
            type: String,
            default: null,
            index: true,
        },

        durationMs: {
            type: Number,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

apiLogSchema.index({ createdAt: -1 });
apiLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("MandateApiLog", apiLogSchema);
