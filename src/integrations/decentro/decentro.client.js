const axios = require("axios");
const ApiError = require("../../utils/ApiError");

/**
 * Reusable Decentro HTTP client.
 * Credentials come from env — never hardcode secrets.
 */
class DecentroClient {
    constructor() {
        this.baseURL =
            process.env.DECENTRO_BASE_URL ||
            "https://in.staging.decentro.tech";
        this.clientId = process.env.DECENTRO_CLIENT_ID;
        this.clientSecret = process.env.DECENTRO_CLIENT_SECRET;
    }

    assertConfigured() {
        if (!this.clientId || !this.clientSecret) {
            throw new ApiError(
                500,
                "Decentro credentials are not configured. Set DECENTRO_CLIENT_ID and DECENTRO_CLIENT_SECRET"
            );
        }
    }

    get headers() {
        this.assertConfigured();
        return {
            "Content-Type": "application/json",
            client_id: this.clientId,
            client_secret: this.clientSecret,
        };
    }

    async post(path, body) {
        this.assertConfigured();

        try {
            const response = await axios.post(
                `${this.baseURL.replace(/\/$/, "")}${path}`,
                body,
                {
                    headers: this.headers,
                    timeout: Number(process.env.DECENTRO_TIMEOUT_MS) || 60000,
                    validateStatus: () => true,
                }
            );

            return {
                statusCode: response.status,
                data: response.data,
            };
        } catch (err) {
            throw new ApiError(
                502,
                err.message || "Failed to reach Decentro API"
            );
        }
    }
}

module.exports = new DecentroClient();
