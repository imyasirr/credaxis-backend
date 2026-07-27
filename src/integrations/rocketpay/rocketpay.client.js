const axios = require("axios");
const ApiError = require("../../utils/ApiError");

/**
 * RocketPay Mandate V4 HTTP client.
 * Auth: x-app-context + x-token (merchant token from env).
 */
class RocketPayClient {
    constructor() {
        this.baseURL =
            process.env.ROCKETPAY_BASE_URL ||
            "https://api-staging.rocketpay.co.in";
        this.token = process.env.ROCKETPAY_TOKEN;
        this.appContext =
            process.env.ROCKETPAY_APP_CONTEXT || "MERCHANT_API";
        this.timeout =
            Number(process.env.ROCKETPAY_TIMEOUT_MS) || 60000;
    }

    assertConfigured() {
        if (!this.token) {
            throw new ApiError(
                500,
                "RocketPay is not configured. Set ROCKETPAY_TOKEN"
            );
        }
    }

    get headers() {
        this.assertConfigured();
        return {
            "Content-Type": "application/json",
            "x-app-context": this.appContext,
            "x-token": this.token,
        };
    }

    url(path) {
        return `${this.baseURL.replace(/\/$/, "")}${path}`;
    }

    async request(method, path, { body = null, query = null } = {}) {
        this.assertConfigured();

        try {
            const response = await axios({
                method,
                url: this.url(path),
                headers: this.headers,
                data: body ?? undefined,
                params: query ?? undefined,
                timeout: this.timeout,
                validateStatus: () => true,
            });

            return {
                statusCode: response.status,
                data: response.data,
                headers: response.headers,
            };
        } catch (err) {
            throw new ApiError(
                502,
                err.message || "Failed to reach RocketPay API"
            );
        }
    }

    // ── Mandates ──────────────────────────────────────────────
    createMandate(body) {
        return this.request("POST", "/v4/mandates", { body });
    }

    getMandate(mandateId) {
        return this.request("GET", `/v4/mandates/${mandateId}`);
    }

    refreshMandate(mandateId) {
        return this.request("POST", `/v4/mandates/${mandateId}/refresh`);
    }

    deleteMandate(mandateId) {
        return this.request("DELETE", `/v4/mandates/${mandateId}`);
    }

    cancelMandate(mandateId) {
        return this.request("POST", `/v4/mandates/${mandateId}/cancel`);
    }

    createInstallment(mandateId, body) {
        return this.request("POST", `/v4/mandates/${mandateId}/installment`, {
            body,
        });
    }

    // ── Installments ──────────────────────────────────────────
    listInstallments(mandateId) {
        return this.request("GET", "/v4/installments", {
            query: { mandate_id: mandateId },
        });
    }

    getInstallment(installmentId) {
        return this.request("GET", `/v4/installments/${installmentId}`);
    }

    refreshInstallment(installmentId) {
        return this.request(
            "POST",
            `/v4/installments/${installmentId}/refresh`
        );
    }

    skipInstallment(installmentId) {
        return this.request("POST", `/v4/installments/${installmentId}/skip`);
    }

    retryInstallment(installmentId, body) {
        return this.request("POST", `/v4/installments/${installmentId}/retry`, {
            body,
        });
    }
}

module.exports = new RocketPayClient();
