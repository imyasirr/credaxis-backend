const mongoose = require("mongoose");

const TRIGGERS = [
    "REFERRAL_REFERRER",
    "REFERRAL_REFEREE",
    "USER_SIGNUP",
    "KYC_APPROVED",
    "MANUAL",
];

const AUDIENCES = ["ALL", "USER", "PARTNER", "SPECIFIC"];

const GAME_TYPES = ["WHEEL", "SCRATCH", "SHUFFLE", "BUBBLE"];

const rewardRuleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },

        description: {
            type: String,
            trim: true,
            default: "",
            maxlength: 500,
        },

        enabled: {
            type: Boolean,
            default: true,
            index: true,
        },

        /** WHEN — event that grants game plays */
        trigger: {
            type: String,
            enum: TRIGGERS,
            required: true,
            index: true,
        },

        /** WHO — audience filter */
        audience: {
            type: String,
            enum: AUDIENCES,
            default: "ALL",
            index: true,
        },

        /** Required when audience = SPECIFIC */
        userIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        /**
         * WHICH game to unlock.
         * Rules grant plays only — prize comes when the user plays.
         */
        gameType: {
            type: String,
            enum: GAME_TYPES,
            required: true,
        },

        /** @deprecated Legacy — rules no longer grant catalog prizes */
        prizeId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        /** @deprecated Legacy — ignored for play-only rules */
        valueOverride: {
            type: Number,
            default: null,
            min: 0,
        },

        /** How many plays to grant when the rule fires */
        plays: {
            type: Number,
            default: 1,
            min: 1,
            max: 100,
        },

        /** Optional schedule window */
        startAt: {
            type: Date,
            default: null,
        },

        endAt: {
            type: Date,
            default: null,
        },

        /** Max times one user can receive this rule (null = unlimited) */
        maxPerUser: {
            type: Number,
            default: 1,
            min: 0,
        },

        /** Max total grants under this rule (null = unlimited) */
        maxTotal: {
            type: Number,
            default: null,
            min: 0,
        },

        grantCount: {
            type: Number,
            default: 0,
            min: 0,
        },

        createdBy: {
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

rewardRuleSchema.index({ trigger: 1, enabled: 1 });
rewardRuleSchema.index({ name: 1 });

module.exports = mongoose.model("RewardRule", rewardRuleSchema);
module.exports.TRIGGERS = TRIGGERS;
module.exports.AUDIENCES = AUDIENCES;
module.exports.GAME_TYPES = GAME_TYPES;
