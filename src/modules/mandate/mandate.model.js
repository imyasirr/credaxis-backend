const mongoose = require("mongoose");

const mandateSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },

        /** RocketPay mandate id */
        rocketpayId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
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

        frequency: {
            type: String,
            default: null,
            index: true,
        },

        mode: {
            type: String,
            default: "UPI_AUTO_PAY",
            index: true,
        },

        customerMobile: {
            type: String,
            trim: true,
            default: null,
            index: true,
        },

        customerName: {
            type: String,
            trim: true,
            default: null,
        },

        approvalAmount: { type: Number, default: null },
        advanceAmount: { type: Number, default: null },
        installmentCount: { type: Number, default: null },
        startDate: { type: String, default: null },
        endDate: { type: String, default: null },
        timeZone: { type: String, default: "Asia/Kolkata" },

        paymentOrderId: { type: String, default: null },
        mmsId: { type: String, default: null },
        checkoutUrl: { type: String, default: null },

        payer: { type: mongoose.Schema.Types.Mixed, default: null },
        payees: { type: mongoose.Schema.Types.Mixed, default: null },
        clientMeta: { type: mongoose.Schema.Types.Mixed, default: null },
        meta: { type: mongoose.Schema.Types.Mixed, default: null },
        schedule: { type: mongoose.Schema.Types.Mixed, default: null },

        deleted: { type: Boolean, default: false, index: true },

        /** Full last known RocketPay mandate entity */
        raw: { type: mongoose.Schema.Types.Mixed, default: null },

        lastSyncedAt: { type: Date, default: null },
        source: {
            type: String,
            enum: ["API", "WEBHOOK", "ADMIN", "SYSTEM"],
            default: "API",
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

mandateSchema.index({ createdAt: -1 });
mandateSchema.index({ user: 1, state: 1 });
mandateSchema.index({ customerMobile: 1, state: 1 });

module.exports = mongoose.model("Mandate", mandateSchema);
