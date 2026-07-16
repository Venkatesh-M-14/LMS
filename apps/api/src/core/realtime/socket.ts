import type http from 'node:http';
import { Server } from 'socket.io';
import type { AccessTokenVerifier } from '../../modules/auth/application/ports';

/**
 * Socket.IO with the same JWT the REST API uses. Every authenticated socket
 * joins its user room; server code pushes with io.to(`user:<id>`).
 */
export function createSocketServer(
  httpServer: http.Server,
  verifier: AccessTokenVerifier,
  webOrigin: string,
): Server {
  const io = new Server(httpServer, {
    cors: { origin: [webOrigin], credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = typeof token === 'string' ? verifier.verify(token) : null;
    if (!payload) {
      next(new Error('unauthorized'));
      return;
    }
    socket.data.userId = payload.sub;
    next();
  });

  io.on('connection', (socket) => {
    void socket.join(`user:${socket.data.userId as string}`);
  });

  return io;
}
