const mongoose = require("mongoose");

const TRIGGERS = [
    "REFERRAL_REFERRER",
    "REFERRAL_REFEREE",
    "USER_SIGNUP",
    "KYC_APPROVED",
    "MANUAL",
];

const AUDIENCES = ["ALL", "USER", "PARTNER", "SPECIFIC"];

const GAME_TYPES = ["WHEEL", "SCRATCH", "SHUFFLE"];

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

        /** WHEN — event that grants this reward */
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

        /** WHICH — prize catalog */
        gameType: {
            type: String,
            enum: GAME_TYPES,
            required: true,
        },

        prizeId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        /**
         * HOW MUCH — optional override of prize.value.
         * null = use prize catalog value.
         */
        valueOverride: {
            type: Number,
            default: null,
            min: 0,
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
