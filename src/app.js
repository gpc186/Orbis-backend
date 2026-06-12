const express = require("express");
const cors = require("cors");

const errorMiddleware = require("./middlewares/errorMiddleware");
const requestContextMiddleware = require("./middlewares/requestContextMiddleware");

const leituraRoutes = require("./routes/leituraRoutes");
const maquinaRoutes = require("./routes/maquinaRoutes");
const sensorRoutes = require("./routes/sensorRoutes");
const authRoutes = require("./routes/authRoutes");
const usuarioRoutes = require("./routes/usuarioRoutes");
const perfilRoutes = require("./routes/perfilRoutes");
const manutencaoRoutes = require("./routes/manutencaoRoutes");
const tecnicoRoutes = require("./routes/tecnicoRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const emailRoutes = require("./routes/emailRoutes");
const relatorioRoutes = require("./routes/relatorioRoutes");
const relatorioAgendamentoRoutes = require("./routes/relatorioAgendamentoRoutes");
const resetSenhaRoutes = require("./routes/resetSenhaRoutes");
const dashboardAiRoutes = require("./routes/dashboardAiRoutes");
const alertaRoutes = require("./routes/alertaRoutes");
const historicoIntegridadeRoutes = require("./routes/historicoIntegridadeRoutes");
const ReadinessService = require("./services/readinessService");

function createApp({ io = null } = {}) {
  const app = express();

  app.use(cors({
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    maxAge: 600
  }));
  app.use(express.json());
  app.use(requestContextMiddleware);

  if (io) {
    app.set("io", io);
  }

  app.get("/", (req, res) => res.send("Orbis API - Online"));
  app.get("/health", (req, res) => res.status(200).json({ ok: true }));
  app.get("/ready", async (req, res, next) => {
    try {
      const readiness = await ReadinessService.check();
      const statusCode = readiness.ok ? 200 : 503;

      return res.status(statusCode).json(readiness);
    } catch (error) {
      return next(error);
    }
  });

  app.use("/leituras", leituraRoutes);
  app.use("/maquinas", maquinaRoutes);
  app.use("/sensores", sensorRoutes);
  app.use("/manutencoes", manutencaoRoutes);
  app.use("/tecnicos", tecnicoRoutes);
  app.use("/dashboard", dashboardRoutes);
  app.use("/alertas", alertaRoutes);
  app.use("/historico-integridade", historicoIntegridadeRoutes);
  app.use("/auth", authRoutes);
  app.use("/usuarios", usuarioRoutes);
  app.use("/perfil", perfilRoutes);
  app.use("/email", emailRoutes);
  app.use("/relatorios", relatorioRoutes);
  app.use("/relatorios", relatorioAgendamentoRoutes);
  app.use("/senha", resetSenhaRoutes);
  app.use("/dashboard/ia", dashboardAiRoutes);

  app.use(errorMiddleware);

  return app;
}

module.exports = createApp;
