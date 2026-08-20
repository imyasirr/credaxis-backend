const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },

        description: {
            type: String,
            trim: true,
            default: "",
            maxlength: 500,
        },

        link: {
            type: String,
            trim: true,
            default: "",
            maxlength: 2048,
        },

        image: {
            type: String,
            required: true,
            trim: true,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE"],
            default: "ACTIVE",
            index: true,
        },

        sortOrder: {
            type: Number,
            default: 0,
            min: 0,
        },

        clickCount: {
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

bannerSchema.index({ status: 1, sortOrder: 1, createdAt: -1 });

module.exports = mongoose.model("PromoBanner", bannerSchema);
