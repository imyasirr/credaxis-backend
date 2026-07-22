/**
 * Seeds default COINS prizes + Reward Management rules:
 * - USER_SIGNUP → welcome coins
 * - REFERRAL_REFERRER → referrer coins
 * - REFERRAL_REFEREE → new user (via referral) coins
 *
 * Idempotent: re-run safe (matches by prize title / rule name).
 *
 * Usage: npm run seed:rewards
 */
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../../config/db");
const WheelPrize = require("./wheelPrize.model");
const RewardRule = require("./rewardRule.model");
const Setting = require("../admin/setting.model");

const SIGNUP_COINS = Number(process.env.SEED_SIGNUP_COINS) || 50;
const REFERRER_COINS = Number(process.env.SEED_REFERRER_COINS) || 100;
const REFEREE_COINS = Number(process.env.SEED_REFEREE_COINS) || 50;

const PRIZES = [
    {
        title: "Welcome Coins (Signup)",
        description: "Coins credited on new user registration",
        value: SIGNUP_COINS,
        color: "#0ea5e9",
        frequency: 1,
        sortOrder: 90,
    },
    {
        title: "Referral Bonus (Referrer)",
        description: "Coins for the user who shared the referral code",
        value: REFERRER_COINS,
        color: "#f59e0b",
        frequency: 1,
        sortOrder: 91,
    },
    {
        title: "Referral Bonus (New User)",
        description: "Coins for the user who joined with a referral code",
        value: REFEREE_COINS,
        color: "#22c55e",
        frequency: 1,
        sortOrder: 92,
    },
];

const RULES = [
    {
        name: "Signup Welcome Coins",
        description: "Grant welcome coins when a user registers",
        trigger: "USER_SIGNUP",
        prizeTitle: "Welcome Coins (Signup)",
    },
    {
        name: "Referral Reward — Referrer",
        description: "Grant coins to the user who referred someone",
        trigger: "REFERRAL_REFERRER",
        prizeTitle: "Referral Bonus (Referrer)",
    },
    {
        name: "Referral Reward — New User",
        description: "Grant coins to the user who signed up with a referral code",
        trigger: "REFERRAL_REFEREE",
        prizeTitle: "Referral Bonus (New User)",
    },
];

async function upsertPrize(def) {
    let prize = await WheelPrize.findOne({ title: def.title });
    if (!prize) {
        prize = await WheelPrize.create({
            title: def.title,
            description: def.description,
            prizeType: "COINS",
            value: def.value,
            frequency: def.frequency,
            color: def.color,
            status: "ACTIVE",
            sortOrder: def.sortOrder,
            expiryDays: 0,
        });
        console.log(`Created prize: ${def.title} (${def.value} coins)`);
        return prize;
    }

    prize.description = def.description;
    prize.prizeType = "COINS";
    prize.value = def.value;
    prize.frequency = def.frequency;
    prize.color = def.color;
    prize.status = "ACTIVE";
    prize.sortOrder = def.sortOrder;
    prize.expiryDays = 0;
    await prize.save();
    console.log(`Updated prize: ${def.title} (${def.value} coins)`);
    return prize;
}

async function upsertRule(def, prizeMap) {
    const prize = prizeMap[def.prizeTitle];
    if (!prize) {
        throw new Error(`Missing prize for rule: ${def.name}`);
    }

    let rule = await RewardRule.findOne({ name: def.name });
    if (!rule) {
        rule = await RewardRule.create({
            name: def.name,
            description: def.description,
            enabled: true,
            trigger: def.trigger,
            audience: "ALL",
            userIds: [],
            gameType: "WHEEL",
            prizeId: prize._id,
            valueOverride: null,
            maxPerUser: 1,
            maxTotal: null,
            grantCount: 0,
        });
        console.log(`Created rule: ${def.name} → ${def.trigger}`);
        return rule;
    }

    rule.description = def.description;
    rule.enabled = true;
    rule.trigger = def.trigger;
    rule.audience = "ALL";
    rule.gameType = "WHEEL";
    rule.prizeId = prize._id;
    rule.valueOverride = null;
    rule.maxPerUser = 1;
    await rule.save();
    console.log(`Updated rule: ${def.name} → ${def.trigger}`);
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

    const prizeMap = {};
    for (const def of PRIZES) {
        const prize = await upsertPrize(def);
        prizeMap[def.title] = prize;
    }

    for (const def of RULES) {
        await upsertRule(def, prizeMap);
    }

    await disableLegacyReferralSetting();

    console.log("\nReward seed complete.");
    console.log(
        `Signup: ${SIGNUP_COINS} · Referrer: ${REFERRER_COINS} · Referee: ${REFEREE_COINS}`
    );
    console.log(
        "Manage / edit amounts in Admin → Rewards → Reward Management (or prize catalog)."
    );

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(async (err) => {
    console.error("Reward seed error:", err.message);
    await mongoose.disconnect();
    process.exit(1);
});
