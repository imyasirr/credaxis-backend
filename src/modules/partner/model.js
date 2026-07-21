const mongoose = require("mongoose");

const partnerSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        businessName: {
            type: String,
            required: true,
            trim: true,
        },

        businessType: {
            type: String,
            enum: ["INDIVIDUAL", "SHOP", "DISTRIBUTOR", "AGENCY"],
            required: true,
        },

        ownerName: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            lowercase: true,
            trim: true,
        },

        gstNumber: {
            type: String,
            trim: true,
            uppercase: true,
        },

        panNumber: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },

        address: {
            type: String,
            required: true,
            trim: true,
        },

        city: {
            type: String,
            required: true,
            trim: true,
        },

        state: {
            type: String,
            required: true,
            trim: true,
        },

        pincode: {
            type: String,
            required: true,
            trim: true,
        },

        country: {
            type: String,
            default: "India",
        },

        shopPhoto: String,
        gstDocument: String,
        panDocument: String,

        partnerCode: {
            type: String,
            unique: true,
            sparse: true,
            uppercase: true,
            trim: true,
        },

        commissionRate: {
            type: Number,
            default: 2,
            min: 0,
            max: 100,
        },

        totalReferrals: {
            type: Number,
            default: 0,
            min: 0,
        },

        totalEarnings: {
            type: Number,
            default: 0,
            min: 0,
        },

        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
            default: "PENDING",
        },

        remarks: {
            type: String,
            default: "",
            trim: true,
        },

        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        approvedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

partnerSchema.index({ status: 1 });

module.exports = mongoose.model("Partner", partnerSchema);
