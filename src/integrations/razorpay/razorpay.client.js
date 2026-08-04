const Razorpay = require("razorpay");
const crypto = require("crypto");
const ApiError = require("../../utils/ApiError");

/**
 * Shared Razorpay client — use from payments module only.
 * Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
 */
class RazorpayClient {
    constructor() {
        this.keyId = process.env.RAZORPAY_KEY_ID || "";
        this.keySecret = process.env.RAZORPAY_KEY_SECRET || "";
        this._instance = null;
    }

    assertConfigured() {
        if (!this.keyId || !this.keySecret) {
            throw new ApiError(
                500,
                "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET"
            );
        }
    }

    get instance() {
        this.assertConfigured();
        if (!this._instance) {
            this._instance = new Razorpay({
                key_id: this.keyId,
                key_secret: this.keySecret,
            });
        }
        return this._instance;
    }

    getPublicKey() {
        this.assertConfigured();
        return this.keyId;
    }

    /**
     * @param {{ amountInr: number, currency?: string, receipt: string, notes?: object }} opts
     * amountInr — rupees (will convert to paise)
     */
    async createOrder({ amountInr, currency = "INR", receipt, notes = {} }) {
        this.assertConfigured();

        const amountPaise = Math.round(Number(amountInr) * 100);
        if (!amountPaise || amountPaise < 100) {
            throw new ApiError(400, "Amount must be at least ₹1");
        }

        try {
            const order = await this.instance.orders.create({
                amount: amountPaise,
                currency,
                receipt: String(receipt).slice(0, 40),
                notes,
            });
            return order;
        } catch (err) {
            const message =
                err?.error?.description ||
                err?.message ||
                "Failed to create Razorpay order";
            throw new ApiError(502, message);
        }
    }

    verifyPaymentSignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
    }) {
        this.assertConfigured();

        const body = `${razorpayOrderId}|${razorpayPaymentId}`;
        const expected = crypto
            .createHmac("sha256", this.keySecret)
            .update(body)
            .digest("hex");

        const a = Buffer.from(expected);
        const b = Buffer.from(String(razorpaySignature || ""));

        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            throw new ApiError(400, "Invalid Razorpay payment signature");
        }

        return true;
    }

    async fetchPayment(paymentId) {
        this.assertConfigured();
        try {
            return await this.instance.payments.fetch(paymentId);
        } catch (err) {
            const message =
                err?.error?.description ||
                err?.message ||
                "Failed to fetch Razorpay payment";
            throw new ApiError(502, message);
        }
    }
}

module.exports = new RazorpayClient();
