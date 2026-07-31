const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            default: "",
        },

        fileName: {
            type: String,
            required: true,
        },

        url: {
            type: String,
            required: true,
        },

        alt: {
            type: String,
            default: "",
        },

        mimeType: {
            type: String,
            default: "",
        },

        size: {
            type: Number,
            default: 0,
        },

        folder: {
            type: String,
            default: "website",
        },

        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        status: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

module.exports = mongoose.model("WebsiteMedia", mediaSchema);