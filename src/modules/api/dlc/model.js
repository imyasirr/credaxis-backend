const mongoose = require("mongoose");

const dlcKeySchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
            default: null,
            index: true,
        },

        rocketpaySuperKeyId: {
            type: String,
            trim: true,
            default: null,
            index: true,
        },

        rocketpayKeyId: {
            type: String,
            trim: true,
            default: null,
            unique: true,
            sparse: true,
            index: true,
        },

        customerName: { type: String, trim: true, default: null },
        customerMobile: { type: String, trim: true, default: null, index: true },

        /** Snapshot of CredAxis user (merchant) who registered DLC for the customer */
        merchantName: { type: String, trim: true, default: null },
        merchantMobile: { type: String, trim: true, default: null, index: true },

        manufacturer: { type: String, trim: true, default: null },
        model: { type: String, trim: true, default: null },
        imeiNo: { type: String, trim: true, default: null, index: true },
        imeiNo2: { type: String, trim: true, default: null, index: true },
        mdmType: { type: String, trim: true, default: "DLC" },
        enrolledDeviceImei: { type: String, trim: true, default: null },

        status: { type: String, trim: true, default: "PENDING", index: true },
        keyStatus: { type: String, trim: true, default: null, index: true },
        isLocked: { type: Boolean, default: false, index: true },
        isDeleted: { type: Boolean, default: false, index: true },
        isConsentGiven: { type: Boolean, default: false },

        feeAmount: { type: Number, default: 0 },
        walletTransactionId: { type: String, default: null },

        journey: { type: mongoose.Schema.Types.Mixed, default: [] },
        deviceInfo: { type: mongoose.Schema.Types.Mixed, default: null },
        collectionInfo: { type: mongoose.Schema.Types.Mixed, default: null },
        meta: { type: mongoose.Schema.Types.Mixed, default: null },
        rawSuperKey: { type: mongoose.Schema.Types.Mixed, default: null },
        rawKey: { type: mongoose.Schema.Types.Mixed, default: null },

        lastSyncedAt: { type: Date, default: null },
        source: {
            type: String,
            enum: ["API", "ADMIN", "SYSTEM", "RECON"],
            default: "API",
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

dlcKeySchema.index({ user: 1, createdAt: -1 });
dlcKeySchema.index({ imeiNo: 1, isDeleted: 1 });

module.exports = mongoose.model("DlcKey", dlcKeySchema);
