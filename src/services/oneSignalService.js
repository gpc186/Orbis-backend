const { default: axios } = require("axios");
const AppError = require("../utils/appErrorUtils");

// src/services/oneSignalService.js
class OneSignalService {
    /**
     * Envia push genérico para uma lista de destinatários.
     * @param {Object} params
     * @param {string[]} params.oneSignalIds
     * @param {string} params.title
     * @param {string} params.message
     * @param {Object} [params.data]
     * @returns {Promise<{sent: number, failed: number, providerResponse?: any}>}
     */
    static async sendToOneSignalIds({ oneSignalIds, title, message, data = {} }) {
        const { appId, apiKey } = this.validateConfig();

        if (!oneSignalIds || oneSignalIds.length == 0) {
            throw new AppError("Não é possivel enviar push para nenhum usuario!", 400);
        }

        if (typeof title != "string" || title.trim().length < 3) {
            throw new AppError("Titulo de push inválido!", 400);
        }

        if (typeof message != "string" || message.trim().length < 3) {
            throw new AppError("Message de push inválido!", 400);
        }

        if (typeof data != "object" || !data) {
            throw new AppError("Data de push inválido!", 400);
        }

        const payload = {
            app_id: appId,
            include_subscription_ids: oneSignalIds,
            headings: { en: title, pt: title },
            contents: { en: message, pt: message },
            data
        }

        const url = process.env.ONESIGNAL_API_URL || "https://api.onesignal.com/notifications";

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    Authorization: `Key ${apiKey}`,
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                timeout: 10000,
            })

            const notificationId = response.data?.id;

            if (!notificationId) {
                console.log("Push não gerou um ID de notificação válido!");
                return { sent: 0, failed: oneSignalIds.length, providerResponse: response.data };
            }

            return { sent: oneSignalIds.length, failed: 0, providerResponse: response.data };
        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const providerErrors = error.response.data?.errors;

                if (status === 400) {
                    throw new AppError(`Erro de payload!: ${JSON.stringify(providerErrors || [])}`, 400);
                }

                if (status === 401 || status === 403) {
                    throw new AppError("Falha de autenticação do onesignal", 502);
                }

                if (status === 429) {
                    throw new AppError("Onesginal atigiu limite de taxas!", 503);
                }

                throw new AppError(
                    "Falha ao enviar push pelo OneSignal.",
                    502
                );
            }
            if (error.request) {
                throw new AppError(
                    "OneSignal não respondeu à requisição.",
                    504
                );
            }

            throw new AppError(
                "Erro interno ao preparar o envio do push.",
                500
            );
        }
    }

    // /**
    //  * Helper opcional: envio para um único usuário.
    //  */
    // static async sendToOne({ oneSignalId, title, message, data = {} }) {
    //     // TODO: reaproveitar sendToOneSignalIds
    //     throw new Error("Not implemented");
    // }

    /**
     * Helper opcional: verificar configuração mínima do ambiente.
     */
    static validateConfig() {
        const { ONESIGNAL_APP_ID, ONESIGNAL_API_KEY } = process.env;
        if (!ONESIGNAL_API_KEY || !ONESIGNAL_APP_ID) {
            throw new AppError("OneSignal não está configurado neste ambiente!", 500);
        };

        return { appId: ONESIGNAL_APP_ID, apiKey: ONESIGNAL_API_KEY };
    }
}

module.exports = OneSignalService;