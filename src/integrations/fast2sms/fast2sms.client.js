const axios = require("axios");
const ApiError = require("../../utils/ApiError");

/**
 * Fast2SMS DLT client — OTP / SMS.
 * Env: FAST2SMS_API_KEY, FAST2SMS_ENDPOINT, FAST2SMS_ROUTE,
 *      FAST2SMS_SENDER_ID, FAST2SMS_DLT_MESSAGE_ID, FAST2SMS_LANGUAGE
 */
class Fast2SmsClient {
    constructor() {
        this.apiKey = process.env.FAST2SMS_API_KEY || "";
        this.endpoint =
            process.env.FAST2SMS_ENDPOINT ||
            "https://www.fast2sms.com/dev/bulkV2";
        this.route = process.env.FAST2SMS_ROUTE || "dlt";
        this.senderId = process.env.FAST2SMS_SENDER_ID || "";
        this.messageId = process.env.FAST2SMS_DLT_MESSAGE_ID || "";
        this.language = process.env.FAST2SMS_LANGUAGE || "english";
        this.timeout = Number(process.env.FAST2SMS_TIMEOUT_MS) || 15000;
    }

    assertConfigured(messageId = this.messageId) {
        if (!this.apiKey || !this.senderId || !messageId) {
            throw new ApiError(
                500,
                "Fast2SMS is not configured. Set FAST2SMS_API_KEY, FAST2SMS_SENDER_ID, and a DLT template id"
            );
        }
    }

    /**
     * Send DLT SMS with template variables.
     * @param {{ mobile: string, variablesValues: string, messageId?: string }} opts
     * variablesValues — pipe-separated, e.g. "123456" or "1500|Ramesh Traders"
     */
    async sendDltSms({ mobile, variablesValues, messageId }) {
        const templateId = messageId || this.messageId;
        this.assertConfigured(templateId);

        const numbers = String(mobile || "")
            .replace(/\D/g, "")
            .slice(-10);

        if (!/^[6-9]\d{9}$/.test(numbers)) {
            throw new ApiError(400, "Invalid mobile number for SMS");
        }

        try {
            const response = await axios({
                method: "POST",
                url: this.endpoint,
                headers: {
                    authorization: this.apiKey,
                    "Content-Type": "application/json",
                },
                data: {
                    route: this.route,
                    sender_id: this.senderId,
                    message: templateId,
                    variables_values: String(variablesValues || ""),
                    numbers,
                    flash: 0,
                },
                timeout: this.timeout,
                validateStatus: () => true,
            });

            const data = response.data || {};
            const ok =
                response.status >= 200 &&
                response.status < 300 &&
                (data.return === true ||
                    data.return === "true" ||
                    String(data.status_code) === "200" ||
                    Number(data.status_code) === 200);

            if (!ok) {
                const message =
                    data.message ||
                    (Array.isArray(data.message)
                        ? data.message.join(", ")
                        : null) ||
                    data.error ||
                    `Fast2SMS failed (${response.status})`;
                console.error("[Fast2SMS] send failed:", data);
                throw new ApiError(502, String(message));
            }

            return data;
        } catch (err) {
            if (err instanceof ApiError) throw err;
            throw new ApiError(
                502,
                err.message || "Failed to reach Fast2SMS"
            );
        }
    }

    /** Send OTP using DLT template; OTP is first {#var#}. */
    async sendOtp(mobile, otp) {
        return this.sendDltSms({
            mobile,
            variablesValues: String(otp),
        });
    }
}

module.exports = new Fast2SmsClient();
