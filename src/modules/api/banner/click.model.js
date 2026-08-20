const mongoose = require("mongoose");

const userSnapshotSchema = new mongoose.Schema(
    {
        id: { type: String, default: null },
        mobile: { type: String, default: "" },
        email: { type: String, default: "" },
        firstName: { type: String, default: "" },
        lastName: { type: String, default: "" },
        fullName: { type: String, default: "" },
        status: { type: String, default: "" },
        role: { type: String, default: "" },
    },
    { _id: false }
);

const bannerClickSchema = new mongoose.Schema(
    {
        banner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PromoBanner",
            required: true,
            index: true,
        },

        ipAddress: {
            type: String,
            trim: true,
            default: "",
            index: true,
        },

        userAgent: {
            type: String,
            trim: true,
            default: "",
            maxlength: 512,
        },

        link: {
            type: String,
            trim: true,
            default: "",
        },

        source: {
            type: String,
            enum: ["APP", "ADMIN", "ANONYMOUS"],
            default: "APP",
            index: true,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },

        userSnapshot: {
            type: userSnapshotSchema,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

bannerClickSchema.index({ banner: 1, createdAt: -1 });
bannerClickSchema.index({ ipAddress: 1, createdAt: -1 });

module.exports = mongoose.model("PromoBannerClick", bannerClickSchema);
