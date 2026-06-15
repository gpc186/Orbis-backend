require("./config/env")();
require("./jobs/tendenciaJob");
require("./jobs/relatorioJob");
require("./jobs/limpezaJob");
require("./jobs/sensorOfflineJob");

const fs = require("fs");
const https = require("https");
const { Server } = require("socket.io");

const logger = require("./utils/logger");
const validarEnv = require("./utils/validarEnv");
const { iniciarSimuladorJob } = require("./jobs/simuladorJob");
const connectMQTT = require("./services/mqttService");
const createApp = require("./app");

validarEnv();

const app = createApp();

const sslOptions = {
  key: fs.readFileSync("/etc/ssl/certs/orbis-server.key"),
  cert: fs.readFileSync("/etc/ssl/certs/orbis-server.crt")
};

const server = https.createServer(sslOptions, app);

const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.set("io", io);
iniciarSimuladorJob(io);
connectMQTT(app);

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
server.listen(PORT, '0.0.0.0', () => {
  logger.info("server_started", {
    port: PORT,
    url: `https://localhost:${PORT}`,
    websocket: "active"
  });
});