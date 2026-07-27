const mongoose = require("mongoose");
const { WEBHOOK_ENTITY_TYPES } = require("./constants");

const webhookLogSchema = new mongoose.Schema(
    {
        entityType: {
            type: String,
            enum: WEBHOOK_ENTITY_TYPES,
            default: "UNKNOWN",
            index: true,
        },

        rocketpayEntityId: {
            type: String,
            default: null,
            index: true,
        },

        mandate: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Mandate",
            default: null,
            index: true,
        },

        installment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MandateInstallment",
            default: null,
            index: true,
        },

        payload: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },

        headers: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        ipAddress: {
            type: String,
            default: null,
        },

        processed: {
            type: Boolean,
            default: false,
            index: true,
        },

        processError: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

webhookLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("MandateWebhookLog", webhookLogSchema);
