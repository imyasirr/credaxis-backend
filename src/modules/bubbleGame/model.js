const mongoose = require("mongoose");

/** Singleton admin config for Bubble Pop (not a prize catalog). */
const bubbleGameSettingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            default: "BUBBLE_POP",
            unique: true,
            immutable: true,
        },
        enabled: { type: Boolean, default: true },
        /** How many bubbles fall in one round (finite — round ends after these). */
        totalBubbles: { type: Number, default: 30, min: 5, max: 200 },
        /** Fall speed multiplier (1 = normal). */
        fallSpeed: { type: Number, default: 2, min: 2, max: 4 },
        /** Coins credited per successfully popped bubble. */
        coinsPerBubble: { type: Number, default: 1, min: 0, max: 100 },
        /** Optional bombs in the round (tap/swipe = game over for that play). */
        bombCount: { type: Number, default: 2, min: 0, max: 30 },
        /** How many missed bubbles allowed before game over. */
        maxMisses: { type: Number, default: 3, min: 1, max: 20 },
        /** Hard cap on coins from one play. */
        maxCoinsPerPlay: { type: Number, default: 100, min: 1, max: 10000 },
    },
    { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("BubbleGameSetting", bubbleGameSettingSchema);
