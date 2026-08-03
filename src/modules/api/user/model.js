const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            trim: true,
            lowercase: true,
            minlength: 3,
            maxlength: 30,
        },

        // Contact Information
        email: {
            type: String,
            lowercase: true,
            trim: true,
        },

        mobile: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        countryCode: {
            type: String,
            default: "+91",
        },

        // Authentication
        password: {
            type: String,
            minlength: 8,
            select: false,
        },

        // Role Reference
        role: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Role",
            required: true,
        },

        // Account Status
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "BLOCKED", "SUSPENDED"],
            default: "ACTIVE",
        },

        statusReason: {
            type: String,
            trim: true,
            default: null,
        },

        statusChangedAt: {
            type: Date,
            default: null,
        },

        statusChangedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // Verification
        isEmailVerified: {
            type: Boolean,
            default: false,
        },

        isMobileVerified: {
            type: Boolean,
            default: false,
        },

        // Security
        failedLoginAttempts: {
            type: Number,
            default: 0,
        },

        lastLogin: {
            type: Date,
            default: null,
        },

        lastPasswordChangedAt: {
            type: Date,
            default: null,
        },

        // Referral
        referralCode: {
            type: String,
            trim: true,
        },

        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // Soft Delete
        isDeleted: {
            type: Boolean,
            default: false,
        },

        deletedAt: {
            type: Date,
            default: null,
        },

        // Audit
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Indexes — sparse so multiple mobile-only users (no email) are allowed
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });
userSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

module.exports = mongoose.model("User", userSchema);