const axios = require("axios");
const ApiError = require("../../utils/ApiError");

/**
 * RocketPay Superkey DLC HTTP client.
 * Uses the same ROCKETPAY_TOKEN as mandates. Does not change mandate client.
 */
class RocketPayDlcClient {
    constructor() {
        this.baseURL =
            process.env.ROCKETPAY_BASE_URL ||
            "https://api-staging.rocketpay.co.in";
        this.token =
            process.env.ROCKETPAY_SUPERKEY_TOKEN ||
            process.env.ROCKETPAY_TOKEN;
        this.appContext =
            process.env.ROCKETPAY_APP_CONTEXT || "MERCHANT_API";
        this.timeout = Number(process.env.ROCKETPAY_TIMEOUT_MS) || 60000;
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
                err.message || "Failed to reach RocketPay Superkey API"
            );
        }
    }

    getDeviceCatalogue(imei) {
        return this.request("GET", "/superkey/keys/device-catalogue", {
            query: { imei },
        });
    }

    createOnlyKey(body) {
        return this.request("POST", "/super-key/v2/only-key", { body });
    }

    listSuperKeys() {
        return this.request("GET", "/super-key/v1/list");
    }

    getKey(keyId) {
        return this.request("GET", `/superkey/keys/v5/${keyId}`);
    }

    refreshKey(keyId) {
        return this.request("GET", `/superkey/keys/v5/${keyId}/refresh`);
    }

    unregisterKey(keyId) {
        return this.request(
            "POST",
            `/superkey/keys/${keyId}/actions/unregister`
        );
    }

    applyControl(keyId, controlName, actionName, body = null) {
        return this.request(
            "PUT",
            `/superkey/keys/${keyId}/control/${controlName}/apply/${actionName}`,
            { body }
        );
    }

    listActions(keyId) {
        return this.request("GET", `/superkey/keys/${keyId}/actions`);
    }

    refreshControls(keyId) {
        return this.request(
            "GET",
            `/superkey/keys/${keyId}/controls/refresh`
        );
    }

    getCoinWallet() {
        return this.request("GET", "/common/wallets/v2", {
            query: { product_type: "COIN" },
        });
    }
}

module.exports = new RocketPayDlcClient();
