require("./config/env")();
require("./jobs/tendenciaJob");
require("./jobs/relatorioJob");
require("./jobs/limpezaJob");
require("./jobs/sensorOfflineJob");

const http = require("http");
const { Server } = require("socket.io");

const logger = require("./utils/logger");
const validarEnv = require("./utils/validarEnv");
const { iniciarSimuladorJob } = require("./jobs/simuladorJob");
const connectMQTT = require("./services/mqttService");
const createApp = require("./app");

validarEnv();

const app = createApp();
const server = http.createServer(app);
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
server.listen(PORT, () => {
  logger.info("server_started", {
    port: PORT,
    url: `http://localhost:${PORT}`,
    websocket: "active"
  });
});
