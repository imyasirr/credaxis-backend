/**
 * Seeds default Reward Management rules (play-only):
 * - USER_SIGNUP → 1 Spin Wheel play
 * - REFERRAL_REFERRER → 1 Spin Wheel play
 * - REFERRAL_REFEREE → 1 Spin Wheel play
 *
 * Prize pools stay in Wheel / Scratch / Shuffle catalogs —
 * users win prizes when they play.
 *
 * Idempotent: re-run safe (matches by rule name).
 *
 * Usage: npm run seed:rewards
 */
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../../config/db");
const RewardRule = require("./rewardRule.model");
const Setting = require("../admin/setting.model");

const RULES = [
    {
        name: "Signup Welcome Play",
        description: "Give 1 Spin Wheel play when a user registers",
        trigger: "USER_SIGNUP",
        gameType: "WHEEL",
        plays: 1,
        legacyNames: ["Signup Welcome Coins"],
    },
    {
        name: "Referral Reward — Referrer Play",
        description: "Give 1 Spin Wheel play to the user who referred someone",
        trigger: "REFERRAL_REFERRER",
        gameType: "WHEEL",
        plays: 1,
        legacyNames: ["Referral Reward — Referrer"],
    },
    {
        name: "Referral Reward — New User Play",
        description:
            "Give 1 Spin Wheel play to the user who signed up with a referral code",
        trigger: "REFERRAL_REFEREE",
        gameType: "WHEEL",
        plays: 1,
        legacyNames: ["Referral Reward — New User"],
    },
];

async function upsertRule(def) {
    let rule = await RewardRule.findOne({ name: def.name });
    if (!rule && def.legacyNames?.length) {
        rule = await RewardRule.findOne({ name: { $in: def.legacyNames } });
    }

    const payload = {
        name: def.name,
        description: def.description,
        enabled: true,
        trigger: def.trigger,
        audience: "ALL",
        userIds: [],
        gameType: def.gameType,
        prizeId: null,
        valueOverride: null,
        plays: def.plays,
        maxPerUser: 1,
        maxTotal: null,
    };

    if (!rule) {
        rule = await RewardRule.create({
            ...payload,
            grantCount: 0,
        });
        console.log(
            `Created rule: ${def.name} → ${def.trigger} (${def.gameType} x${def.plays})`
        );
        return rule;
    }

    Object.assign(rule, payload);
    await rule.save();
    console.log(
        `Updated rule: ${def.name} → ${def.trigger} (${def.gameType} x${def.plays})`
    );
    return rule;
}

async function disableLegacyReferralSetting() {
    await Setting.findOneAndUpdate(
        { key: "USER_REFERRAL" },
        {
            key: "USER_REFERRAL",
            value: {
                enabled: false,
                referrerReward: {
                    enabled: false,
                    gameType: "WHEEL",
                    prizeId: null,
                },
                refereeReward: {
                    enabled: false,
                    gameType: "SCRATCH",
                    prizeId: null,
                },
            },
            description:
                "Deprecated — use Reward Management REFERRAL_* rules instead",
        },
        { upsert: true }
    );
    console.log("Legacy USER_REFERRAL setting forced OFF");
}

async function seed() {
    await connectDB();

    for (const def of RULES) {
        await upsertRule(def);
    }

    await disableLegacyReferralSetting();

    console.log("\nReward seed complete (play-only rules).");
    console.log(
        "Prizes are won in-game — configure catalogs under Spin Wheel / Scratch / Shuffle."
    );

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(async (err) => {
    console.error("Reward seed error:", err.message);
    await mongoose.disconnect();
    process.exit(1);
});
