const mongoose = require("mongoose");

const wheelPrizeSchema = new mongoose.Schema(
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

        prizeType: {
            type: String,
            enum: ["CASH", "TOKEN", "COUPON", "NO_PRIZE"],
            required: true,
            index: true,
        },

        value: {
            type: Number,
            default: 0,
            min: 0,
        },

        frequency: {
            type: Number,
            required: true,
            min: 1,
        },

        color: {
            type: String,
            trim: true,
            default: "#6366f1",
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

        expiryDays: {
            type: Number,
            default: 30,
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

module.exports = mongoose.model("WheelPrize", wheelPrizeSchema);
