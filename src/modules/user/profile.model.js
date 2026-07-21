const mongoose = require("mongoose");

const userProfileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        firstName: {
            type: String,
            trim: true,
        },

        lastName: {
            type: String,
            trim: true,
        },

        isProfileComplete: {
            type: Boolean,
            default: false,
        },

        gender: {
            type: String,
            enum: ["MALE", "FEMALE", "OTHER"],
        },

        dob: {
            type: Date,
        },

        avatar: {
            type: String,
            default: null,
        },

        address: {
            type: String,
            trim: true,
        },

        city: {
            type: String,
            trim: true,
        },

        state: {
            type: String,
            trim: true,
        },

        country: {
            type: String,
            default: "India",
        },

        pincode: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

userProfileSchema.virtual("fullName").get(function () {
    return [this.firstName, this.lastName].filter(Boolean).join(" ");
});

module.exports = mongoose.model(
    "UserProfile",
    userProfileSchema
);