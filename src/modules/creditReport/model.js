const mongoose = require("mongoose");

const creditReportSchema = new mongoose.Schema(
    {
        /** Linked app user when mobile matches; null for external checks */
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },

        /** Admin who initiated the check (admin / third-party pulls) */
        checkedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },

        /** USER = self-serve pull; ADMIN = admin checked any subject */
        source: {
            type: String,
            enum: ["USER", "ADMIN"],
            default: "USER",
            index: true,
        },

        /** SELF = requester's own report; OTHER = a third-party subject */
        subjectType: {
            type: String,
            enum: ["SELF", "OTHER"],
            default: "SELF",
            index: true,
        },

        /** Client-side unique id sent to Decentro */
        referenceId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        provider: {
            type: String,
            default: "EQUIFAX",
            index: true,
        },

        status: {
            type: String,
            enum: ["PENDING", "SUCCESS", "FAILED", "NOT_FOUND"],
            default: "PENDING",
            index: true,
        },

        // Indexed filter fields extracted from bureau response
        name: {
            type: String,
            trim: true,
            default: null,
            index: true,
        },

        mobile: {
            type: String,
            trim: true,
            required: true,
            index: true,
        },

        pan: {
            type: String,
            trim: true,
            uppercase: true,
            default: null,
            index: true,
        },

        score: {
            type: Number,
            default: null,
            index: true,
        },

        scoreName: {
            type: String,
            default: null,
        },

        inquiryPurpose: {
            type: String,
            trim: true,
            default: null,
        },

        decentroTxnId: {
            type: String,
            default: null,
            index: true,
        },

        responseKey: {
            type: String,
            default: null,
        },

        message: {
            type: String,
            default: null,
        },

        /** Saved PDF relative path e.g. /uploads/credit-reports/xxx.pdf */
        pdfPath: {
            type: String,
            default: null,
        },

        /** Full Decentro API response for audit / re-parse */
        rawResponse: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        /** Request payload sent (without secrets) */
        requestPayload: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        errorCode: {
            type: String,
            default: null,
        },

        errorMessage: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

creditReportSchema.index({ user: 1, createdAt: -1 });
creditReportSchema.index({ status: 1, createdAt: -1 });
creditReportSchema.index({ pan: 1, mobile: 1 });

module.exports = mongoose.model("CreditReport", creditReportSchema);
