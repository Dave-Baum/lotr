"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const port = 3000;
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server);
app.use(express_1.default.static('public'));
const rooms = new Map();
const hosts = new Map();
function handleJoin(socket, message) {
    console.log('join', message);
    const name = message.room;
    if (!name) {
        return;
    }
    socket.join(name);
    rooms.set(socket, name);
    if (message.host) {
        hosts.set(name, socket);
    }
}
io.on('connection', socket => {
    console.log('connected');
    socket.on('join', m => handleJoin(socket, m));
    socket.on('disconnect', reason => {
        const name = rooms.get(socket);
        if (name && hosts.get(name) === socket) {
            hosts.delete(name);
        }
        rooms.delete(socket);
    });
    socket.on('notify', m => {
        const room = rooms.get(socket);
        if (room) {
            socket.to(room).emit('notify', m);
        }
    });
    socket.on('post', m => {
        const room = rooms.get(socket);
        if (!room) {
            return;
        }
        const host = hosts.get(room);
        if (!host) {
            return;
        }
        host.emit('post', m);
    });
});
server.listen(port, () => {
    console.log(`[server]: Server is running at https://localhost:${port}`);
});
//# sourceMappingURL=server.js.map