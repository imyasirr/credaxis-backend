const mongoose = require("mongoose");

const GAME_TYPES = ["WHEEL", "SCRATCH", "SHUFFLE", "BUBBLE"];

const userGamePlaySchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        gameType: {
            type: String,
            enum: GAME_TYPES,
            required: true,
            index: true,
        },

        /** Total plays granted in this entitlement row */
        totalPlays: {
            type: Number,
            required: true,
            min: 1,
            default: 1,
        },

        /** How many plays already used */
        usedPlays: {
            type: Number,
            default: 0,
            min: 0,
        },

        expiresAt: {
            type: Date,
            default: null,
            index: true,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "EXHAUSTED", "EXPIRED", "CANCELLED"],
            default: "ACTIVE",
            index: true,
        },

        source: {
            type: String,
            enum: ["ADMIN", "RULE", "OTHER"],
            default: "ADMIN",
        },

        ruleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RewardRule",
            default: null,
        },

        grantedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        note: {
            type: String,
            trim: true,
            default: "",
            maxlength: 300,
        },
    },
    { timestamps: true, versionKey: false }
);

userGamePlaySchema.index({ user: 1, gameType: 1, status: 1 });
userGamePlaySchema.index({ user: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model("UserGamePlay", userGamePlaySchema);
module.exports.GAME_TYPES = GAME_TYPES;
