import express, {Express, Request, Response} from 'express';
import http from 'http';
import {Server, Socket} from 'socket.io';

const port = 3000;
const app: Express = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = new Map<Socket, string>();
const hosts = new Map<string, Socket>();

function handleJoin(socket: Socket, message: any) {
  console.log('join', message);
  const name = message.room as string;
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
