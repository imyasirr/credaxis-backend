const mongoose = require("mongoose");

const buttonSchema = new mongoose.Schema(
    {
        text: {
            type: String,
            default: "",
        },
        link: {
            type: String,
            default: "",
        },
        target: {
            type: String,
            enum: ["_self", "_blank"],
            default: "_self",
        },
    },
    { _id: false }
);

const sectionSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
        },

        title: {
            type: String,
            default: "",
        },

        subtitle: {
            type: String,
            default: "",
        },

        description: {
            type: String,
            default: "",
        },

        image: {
            type: String,
            default: "",
        },

        backgroundImage: {
            type: String,
            default: "",
        },

        buttons: [buttonSchema],

        items: {
            type: mongoose.Schema.Types.Mixed,
            default: [],
        },

        settings: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },

        order: {
            type: Number,
            default: 0,
        },

        status: {
            type: Boolean,
            default: true,
        },
    },
    { _id: false }
);

const seoSchema = new mongoose.Schema(
    {
        metaTitle: String,

        metaDescription: String,

        keywords: [String],

        ogImage: String,
    },
    { _id: false }
);

const pageSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        description: {
            type: String,
            default: "",
        },

        sections: [sectionSchema],

        seo: seoSchema,

        isPublished: {
            type: Boolean,
            default: true,
        },

        status: {
            type: Boolean,
            default: true,
        },

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

module.exports = mongoose.model("WebsitePage", pageSchema);