require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const errorMiddleware = require("./middlewares/errorMiddleware")

const leituraRoutes = require('./routes/leituraRoutes')
const maquinaRoutes = require('./routes/maquinaRoutes')
const sensorRoutes = require('./routes/sensorRoutes')
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const perfilRoutes = require('./routes/perfilRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors());
app.use(express.json());


// Compartilha o 'io' globalmente se precisar usar nos controllers
app.set('io', io);

// Rota Principal
app.get('/', (req, res) => res.send("Orbis API - Online"));

app.use('/leituras', leituraRoutes)
app.use('/maquinas', maquinaRoutes)
app.use('/sensores', sensorRoutes)
app.use('/auth', authRoutes)
app.use('/usuarios', usuarioRoutes)
app.use('/perfil', perfilRoutes)

app.use(errorMiddleware)
// Gerenciamento de Conexões Real-time
io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);
    
    socket.on('disconnect', () => {
        console.log(`❌ Cliente desconectado: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('-------------------------------------------');
    console.log(`🚀 Servidor Orbis rodando em: http://localhost:${PORT}`);
    console.log(`📡 WebSocket ativo para o Dashboard`);
    console.log('-------------------------------------------');
});