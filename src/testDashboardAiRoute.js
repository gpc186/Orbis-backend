const axios = require("axios");
require("dotenv").config();

const API_URL =
  process.env.DASHBOARD_AI_URL || "http://localhost:3001/dashboard/ia/perguntar";

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzc4Nzg0OTE1LCJleHAiOjE3Nzg3ODY3MTV9.uceuTCoxlw46-gjgYryiIP9C0I4zuDztWNMD46rcSko";

const pergunta =
  process.env.AI_PERGUNTA ||
  "Com base no cenário atual, qual deve ser a prioridade agora?";

const historicoPadrao = [
  { role: "user", content: "Como está o cenário operacional hoje?" },
  { role: "assistant", content: "Há alertas ativos e alguns sem atendimento." },
  { role: "user", content: "Quais são os pontos mais críticos?" }
];

function getHistorico() {
  if (!process.env.AI_HISTORICO_JSON) {
    return historicoPadrao;
  }

  try {
    const parsed = JSON.parse(process.env.AI_HISTORICO_JSON);
    return Array.isArray(parsed) ? parsed : historicoPadrao;
  } catch (error) {
    console.warn("AI_HISTORICO_JSON inválido. Usando histórico padrão.");
    return historicoPadrao;
  }
}

async function testarRotaIa() {
  if (!TOKEN) {
    console.error("Defina DASHBOARD_AI_TOKEN no .env ou no ambiente antes de rodar.");
    process.exit(1);
  }

  const payload = {
    pergunta,
    historico: getHistorico()
  };

  try {
    console.log("Enviando requisição para:", API_URL);
    console.log("Payload:");
    console.log(JSON.stringify(payload, null, 2));

    const response = await axios.post(API_URL, payload, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    });

    console.log("\nStatus:", response.status);
    console.log("Resposta:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error("\nErro da API:", error.response.status);
      console.error(JSON.stringify(error.response.data, null, 2));
      return;
    }

    console.error("\nFalha ao chamar a rota:", error.message);
  }
}

testarRotaIa();
