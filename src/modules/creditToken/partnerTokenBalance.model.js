const mongoose = require("mongoose");

const TOKEN_TYPES = ["CRIF", "CIBIL", "EXPERIAN"];

const partnerTokenBalanceSchema = new mongoose.Schema(
    {
        partner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Partner",
            required: true,
            index: true,
        },

        partnerUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        tokenType: {
            type: String,
            enum: TOKEN_TYPES,
            required: true,
        },

        availableQuantity: {
            type: Number,
            default: 0,
            min: 0,
        },

        totalReceived: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

partnerTokenBalanceSchema.index(
    { partner: 1, tokenType: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "PartnerTokenBalance",
    partnerTokenBalanceSchema
);
module.exports.TOKEN_TYPES = TOKEN_TYPES;
