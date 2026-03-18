require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const leituraController = require('./controllers/leituraController');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Rota Principal
app.get('/', (req, res) => res.send("Orbis API - Online"));

// ROTA: O ESP32 envia dados para cá
app.post('/leituras', leituraController.store);

// Compartilha o 'io' globalmente se precisar usar nos controllers depois
app.set('io', io);

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`O Servidor rodando em http://localhost:${PORT}`);
}); 