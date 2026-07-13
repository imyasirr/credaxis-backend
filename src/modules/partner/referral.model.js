const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
    {
        partner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Partner",
            required: true,
        },

        partnerUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        referredUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        partnerCode: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },

        status: {
            type: String,
            enum: ["REGISTERED", "ACTIVE"],
            default: "REGISTERED",
        },

        rewardAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        rewardStatus: {
            type: String,
            enum: ["NONE", "PENDING", "PAID"],
            default: "NONE",
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

referralSchema.index({ partnerUser: 1, createdAt: -1 });
referralSchema.index({ partner: 1 });
referralSchema.index({ partnerCode: 1 });

module.exports = mongoose.model("Referral", referralSchema);
