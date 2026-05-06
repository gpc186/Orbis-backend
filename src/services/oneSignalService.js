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

        if(!oneSignalIds || oneSignalIds.length == 0){
            throw new AppError("Não é possivel enviar push para nenhum usuario!", 400);
        }

        if(typeof title != "string" || title.trim().length < 3){
            throw new AppError("Titulo de push inválido!", 400);
        }

        if(typeof message != "string" || message.trim().length < 3){
            throw new AppError("Titulo de push inválido!", 400);
        }

        if(typeof data != "object"){
            throw new AppError("Data de push inválido!", 400);
        }
        
        const payload = {
            app_id: appId,
            include_subscription_ids: oneSignalIds,
            target_channel: "push",
            headings: { en: title, pt: title },
            contents: { en: message, pt: message },
            data
        }


        
        // TODO: chamar API do OneSignal
        // TODO: tratar erro técnico sem vazar segredo
        throw new Error("Not implemented");
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
        if(!ONESIGNAL_API_KEY || !ONESIGNAL_APP_ID){
            throw new AppError("OneSignal não está configurado neste ambiente!", 500);
        };

        return { appId: ONESIGNAL_APP_ID, apiKey: ONESIGNAL_API_KEY };
    }
}

module.exports = OneSignalService;