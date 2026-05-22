require("./config/env")();
require("./jobs/tendenciaJob");
require("./jobs/relatorioJob");
require("./jobs/limpezaJob");
require("./jobs/sensorOfflineJob");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const errorMiddleware = require("./middlewares/errorMiddleware");
const requestContextMiddleware = require("./middlewares/requestContextMiddleware");
const logger = require("./utils/logger");

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
const validarEnv = require("./utils/validarEnv");
const { iniciarSimuladorJob } = require("./jobs/simuladorJob");
const alertaRoutes = require("./routes/alertaRoutes");
const historicoIntegridadeRoutes = require("./routes/historicoIntegridadeRoutes");
const connectMQTT = require("./services/mqttService");
const ReadinessService = require("./services/readinessService");

validarEnv();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors());
app.use(express.json());
app.use(requestContextMiddleware);

app.set("io", io);
iniciarSimuladorJob(io);
connectMQTT(app);

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

io.on("connection", (socket) => {
  logger.info("socket_connected", {
    socketId: socket.id
  });

  socket.on("disconnect", () => {
    logger.info("socket_disconnected", {
      socketId: socket.id
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info("server_started", {
    port: PORT,
    url: `http://localhost:${PORT}`,
    websocket: "active"
  });
});
