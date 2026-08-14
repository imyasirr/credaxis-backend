const mongoose = require("mongoose");

const installmentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },

        mandate: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Mandate",
            default: null,
            index: true,
        },

        rocketpayId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },

        rocketpayMandateId: {
            type: String,
            trim: true,
            default: null,
            index: true,
        },

        referenceId: {
            type: String,
            trim: true,
            default: null,
            index: true,
        },

        referenceType: {
            type: String,
            trim: true,
            default: "MAIN",
        },

        state: {
            type: String,
            default: "CREATED",
            index: true,
        },

        dueDate: { type: String, default: null, index: true },
        scheduleDate: { type: String, default: null },
        timeZone: { type: String, default: "Asia/Kolkata" },
        amount: { type: Number, default: null },

        paymentOrderId: { type: String, default: null },
        mmsId: { type: String, default: null },

        payer: { type: mongoose.Schema.Types.Mixed, default: null },
        payees: { type: mongoose.Schema.Types.Mixed, default: null },
        clientMeta: { type: mongoose.Schema.Types.Mixed, default: null },
        meta: { type: mongoose.Schema.Types.Mixed, default: null },

        deleted: { type: Boolean, default: false, index: true },
        raw: { type: mongoose.Schema.Types.Mixed, default: null },
        lastSyncedAt: { type: Date, default: null },
        source: {
            type: String,
            enum: ["API", "WEBHOOK", "ADMIN", "SYSTEM"],
            default: "API",
        },

        sms: {
            collectionSentAt: { type: Date, default: null },
            settlementSentAt: { type: Date, default: null },
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

installmentSchema.index({ createdAt: -1 });
installmentSchema.index({ rocketpayMandateId: 1, state: 1 });

module.exports = mongoose.model("MandateInstallment", installmentSchema);
