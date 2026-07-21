const mongoose = require("mongoose");

const creditTokenSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            trim: true,
            default: "",
        },

        tokenType: {
            type: String,
            enum: ["CRIF", "CIBIL", "EXPERIAN"],
            required: true,
            index: true,
        },

        planType: {
            type: String,
            enum: ["NORMAL", "POPULAR"],
            default: "NORMAL",
        },

        badge: {
            type: String,
            trim: true,
            default: "",
        },

        price: {
            type: Number,
            required: true,
            min: 0,
        },

        quantity: {
            type: Number,
            required: true,
            min: 1,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE"],
            default: "ACTIVE",
        },

        sortOrder: {
            type: Number,
            default: 0,
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

module.exports = mongoose.model("CreditToken", creditTokenSchema);
