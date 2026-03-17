import express from "express";
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { createCA, createCert } from "mkcert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

const localIP = getLocalIP();

async function startServer() {
  const app = express();
  let server;
  let isHttps = false;

  // 如果是在开发环境下（非 production），我们自动生成一张局域网通用的自签名证书
  // 因为 Web Crypto (端到端加密) 在局域网 IP 下必须有 HTTPS 支持，尤其是对于 Safari
  if (process.env.NODE_ENV !== "production") {
    console.log("正在生成局域网 SSL 证书，请稍候...");
    const ca = await createCA({
      organization: "OpenClaw Local CA",
      countryCode: "CN",
      state: "Shanghai",
      locality: "Shanghai",
      validity: 365
    });

    const cert = await createCert({
      domains: ["127.0.0.1", "localhost", "0.0.0.0", localIP],
      validity: 365,
      ca: ca
    });

    const certConfig = {
      key: cert.key,
      cert: cert.cert,
    };
    server = createHttpsServer(certConfig, app);
    isHttps = true;
    console.log("局域网开发环境 HTTPS 启动成功。");
  } else {
    // 生产环境往往由反向代理(如 Nginx/Cloudflare)负责提供 HTTPS，内部直接用 HTTP
    server = createHttpServer(app);
  }

  const io = new Server(server, {
    cors: {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests from localhost, same-origin, and LAN IPs
        if (!origin ||
            origin.includes("localhost") ||
            origin.includes("127.0.0.1") ||
            origin.startsWith("http://192.168.") ||
            origin.startsWith("https://192.168.") ||
            origin.startsWith("http://10.") ||
            origin.startsWith("https://10.") ||
            origin.startsWith("http://172.16.") ||
            origin.startsWith("https://172.16.")) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 500 * 1024 * 1024, // 500 MB max payload
    pingTimeout: 60000,     // Close connection after 60s without pong
    pingInterval: 25000,    // Ping every 25s
  });

  const PORT = parseInt(process.env.PORT || "3001", 10);

  // Track which rooms each socket is in for accurate peer count
  const socketRooms = new Map<string, Set<string>>();

  // Simple rate limiter: max messages per socket per second
  const messageRates = new Map<string, { count: number; resetAt: number }>();
  const MAX_MESSAGES_PER_SECOND = 20;

  function isRateLimited(socketId: string): boolean {
    const now = Date.now();
    const rate = messageRates.get(socketId);
    if (!rate || now > rate.resetAt) {
      messageRates.set(socketId, { count: 1, resetAt: now + 1000 });
      return false;
    }
    rate.count++;
    return rate.count > MAX_MESSAGES_PER_SECOND;
  }

  function getRoomMemberCount(roomId: string): number {
    const room = io.sockets.adapter.rooms.get(roomId);
    return room ? room.size : 0;
  }

  function broadcastRoomCount(roomId: string) {
    const count = getRoomMemberCount(roomId);
    io.to(roomId).emit("room-count", count);
  }

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socketRooms.set(socket.id, new Set());

    socket.on("join-room", (roomId: string) => {
      socket.join(roomId);
      socketRooms.get(socket.id)?.add(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
      broadcastRoomCount(roomId);
    });

    socket.on("leave-room", (roomId: string) => {
      socket.leave(roomId);
      socketRooms.get(socket.id)?.delete(roomId);
      console.log(`Socket ${socket.id} left room ${roomId}`);
      broadcastRoomCount(roomId);
    });

    socket.on("send-message", (data: { roomId: string; payload: unknown }) => {
      // Rate limit check
      if (isRateLimited(socket.id)) {
        console.warn(`Rate limited: ${socket.id}`);
        return;
      }
      // Verify sender has joined this room
      if (!socketRooms.get(socket.id)?.has(data.roomId)) {
        console.warn(`Socket ${socket.id} attempted to send to room ${data.roomId} without joining`);
        return;
      }
      // payload is fully encrypted -- server is just a relay
      socket.to(data.roomId).emit("receive-message", {
        senderId: socket.id,
        payload: data.payload,
        timestamp: Date.now(),
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      const rooms = socketRooms.get(socket.id);
      if (rooms) {
        // Socket.io auto-removes from rooms on disconnect,
        // but we need to broadcast updated counts
        for (const roomId of rooms) {
          // Use setTimeout to let socket.io finish cleanup first
          setTimeout(() => broadcastRoomCount(roomId), 50);
        }
      }
      socketRooms.delete(socket.id);
      messageRates.delete(socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server } 
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    const protocol = isHttps ? "https" : "http";
    console.log(`OpenClaw Drop server running on ${protocol}://localhost:${PORT}`);
    console.log(`OpenClaw Drop server running on ${protocol}://${localIP}:${PORT}`);
  });
}

startServer();
