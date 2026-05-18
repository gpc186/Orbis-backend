const { default: axios } = require("axios");
const AppError = require("../utils/appErrorUtils");
const logger = require("../utils/logger");

class OneSignalService {
  static async sendToOneSignalIds({ oneSignalIds, title, message, data = {} }) {
    const { appId, apiKey } = this.validateConfig();

    if (!oneSignalIds || oneSignalIds.length === 0) {
      throw new AppError("Nao e possivel enviar push para nenhum usuario!", 400);
    }

    if (typeof title !== "string" || title.trim().length < 3) {
      throw new AppError("Titulo de push invalido!", 400);
    }

    if (typeof message !== "string" || message.trim().length < 3) {
      throw new AppError("Message de push invalido!", 400);
    }

    if (typeof data !== "object" || !data) {
      throw new AppError("Data de push invalido!", 400);
    }

    const payload = {
      app_id: appId,
      include_subscription_ids: oneSignalIds,
      headings: { en: title, pt: title },
      contents: { en: message, pt: message },
      data
    };

    const url = process.env.ONESIGNAL_API_URL || "https://api.onesignal.com/notifications";
    const startedAt = Date.now();

    try {
      logger.info("onesignal_request_started", {
        recipientCount: oneSignalIds.length,
        timeoutMs: 10000
      });

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        timeout: 10000
      });

      const notificationId = response.data?.id;

      if (!notificationId) {
        logger.warn("onesignal_missing_notification_id", {
          recipientCount: oneSignalIds.length,
          durationMs: Date.now() - startedAt
        });

        return {
          sent: 0,
          failed: oneSignalIds.length,
          providerResponse: response.data
        };
      }

      logger.info("onesignal_request_finished", {
        recipientCount: oneSignalIds.length,
        notificationId,
        durationMs: Date.now() - startedAt
      });

      return {
        sent: oneSignalIds.length,
        failed: 0,
        providerResponse: response.data
      };
    } catch (error) {
      logger.error("onesignal_request_error", {
        recipientCount: oneSignalIds.length,
        durationMs: Date.now() - startedAt,
        statusCode: error.response?.status || 500,
        error
      });

      if (error.response) {
        const status = error.response.status;
        const providerErrors = error.response.data?.errors;

        if (status === 400) {
          throw new AppError(`Erro de payload!: ${JSON.stringify(providerErrors || [])}`, 400);
        }

        if (status === 401 || status === 403) {
          throw new AppError("Falha de autenticacao do onesignal", 502);
        }

        if (status === 429) {
          throw new AppError("Onesignal atingiu limite de taxas!", 503);
        }

        throw new AppError("Falha ao enviar push pelo OneSignal.", 502);
      }

      if (error.request) {
        throw new AppError("OneSignal nao respondeu a requisicao.", 504);
      }

      throw new AppError("Erro interno ao preparar o envio do push.", 500);
    }
  }

  static validateConfig() {
    const { ONESIGNAL_APP_ID, ONESIGNAL_API_KEY } = process.env;

    if (!ONESIGNAL_API_KEY || !ONESIGNAL_APP_ID) {
      throw new AppError("OneSignal nao esta configurado neste ambiente!", 500);
    }

    return { appId: ONESIGNAL_APP_ID, apiKey: ONESIGNAL_API_KEY };
  }
}

module.exports = OneSignalService;
