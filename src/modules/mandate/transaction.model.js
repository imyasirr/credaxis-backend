const mongoose = require("mongoose");

/**
 * Flattened RocketPay meta.txns entries for mandate / installment.
 */
const mandateTransactionSchema = new mongoose.Schema(
    {
        rocketpayTxnId: {
            type: String,
            required: true,
            trim: true,
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

        entityType: {
            type: String,
            enum: ["MANDATE", "INSTALLMENT"],
            required: true,
            index: true,
        },

        state: { type: String, default: null, index: true },
        medium: { type: String, default: null },
        utr: { type: String, default: null, index: true },
        genericError: { type: mongoose.Schema.Types.Mixed, default: null },
        txnMeta: { type: mongoose.Schema.Types.Mixed, default: null },
        txnCreatedAt: { type: Date, default: null },

        raw: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

mandateTransactionSchema.index(
    { rocketpayTxnId: 1, entityType: 1 },
    { unique: true }
);
mandateTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model(
    "MandateTransaction",
    mandateTransactionSchema
);
