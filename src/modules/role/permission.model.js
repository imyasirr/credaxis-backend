const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
    {
        module: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },

        displayName: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            default: "",
            trim: true,
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

permissionSchema.index({ module: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Permission", permissionSchema);