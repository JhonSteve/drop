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
      organization: "Drop Local CA",
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
        // Allow requests from localhost, LAN IPs, and the Cloudflare domain
        if (!origin ||
            origin.includes("localhost") ||
            origin.includes("127.0.0.1") ||
            origin.startsWith("http://192.168.") ||
            origin.startsWith("https://192.168.") ||
            origin.startsWith("http://10.") ||
            origin.startsWith("https://10.") ||
            origin.startsWith("http://172.16.") ||
            origin.startsWith("https://172.16.") ||
            origin === "https://drop.jhonsteve.com") {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"], // Prefer websocket, fallback to polling for Cloudflare Tunnel
    maxHttpBufferSize: 500 * 1024 * 1024, // 500 MB max payload
    pingTimeout: 60000,     // Close connection after 60s without pong
    pingInterval: 25000,    // Ping every 25s
  });

  const PORT = parseInt(process.env.PORT || "3001", 10);

  // Track which rooms each socket is in for accurate peer count
  const socketRooms = new Map<string, Set<string>>();

  // Track active rooms and their member counts for LAN discovery
  const activeRooms = new Map<string, number>();

  // Track ephemeral room metadata for convenience joins
  const roomCodes = new Map<string, string>();
  const codeToRoom = new Map<string, string>();
  const roomHashes = new Map<string, string>();
  const pendingRoomCodeRequests = new Map<
    string,
    {
      requesterSocketId: string;
      roomId: string;
      expiresAt: number;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  const roomCodeJoinRates = new Map<string, { count: number; resetAt: number }>();
  const ROOM_CODE_REQUEST_TTL_MS = 60_000;
  const MAX_ROOM_CODE_REQUESTS_PER_MINUTE = 5;

  function allocateRoomCode(): string {
    if (codeToRoom.size >= 9000) {
      throw new Error("No room codes available");
    }

    for (let attempts = 0; attempts < 100; attempts += 1) {
      const code = String(Math.floor(Math.random() * 9000) + 1000);
      if (!codeToRoom.has(code)) {
        return code;
      }
    }

    for (let code = 1000; code <= 9999; code += 1) {
      const nextCode = String(code);
      if (!codeToRoom.has(nextCode)) {
        return nextCode;
      }
    }

    throw new Error("No room codes available");
  }

  function ensureRoomCode(roomId: string): string {
    const existingCode = roomCodes.get(roomId);
    if (existingCode) {
      return existingCode;
    }

    const nextCode = allocateRoomCode();
    roomCodes.set(roomId, nextCode);
    codeToRoom.set(nextCode, roomId);
    return nextCode;
  }

  function clearInactiveRoomMetadata(roomId: string) {
    const activeCount = activeRooms.get(roomId) || 0;
    if (activeCount > 0) {
      return;
    }

    const code = roomCodes.get(roomId);
    if (code) {
      roomCodes.delete(roomId);
      codeToRoom.delete(code);
    }
    roomHashes.delete(roomId);

    for (const [requestId, request] of pendingRoomCodeRequests.entries()) {
      if (request.roomId !== roomId) {
        continue;
      }

      rejectPendingRoomCodeRequest(requestId, "expired");
    }
  }

  function emitRoomCode(roomId: string) {
    const activeCount = activeRooms.get(roomId) || 0;
    if (activeCount <= 0) {
      return;
    }

    const code = ensureRoomCode(roomId);
    io.to(roomId).emit("room-code", code);
  }

  function broadcastRoomList() {
    const rooms: Array<{ members: number }> = [];
    activeRooms.forEach((count, roomId) => {
      if (count > 0) {
        rooms.push({
          members: count,
        });
      }
    });
    io.emit("room-list-update", rooms);
  }

  function isRoomCodeJoinRateLimited(socketId: string): boolean {
    const now = Date.now();
    const rate = roomCodeJoinRates.get(socketId);
    if (!rate || now > rate.resetAt) {
      roomCodeJoinRates.set(socketId, { count: 1, resetAt: now + 60_000 });
      return false;
    }

    rate.count += 1;
    return rate.count > MAX_ROOM_CODE_REQUESTS_PER_MINUTE;
  }

  function rejectPendingRoomCodeRequest(requestId: string, reason: "rejected" | "expired") {
    const request = pendingRoomCodeRequests.get(requestId);
    if (!request) {
      return;
    }

    clearTimeout(request.timeout);
    pendingRoomCodeRequests.delete(requestId);
    io.to(request.requesterSocketId).emit(
      reason === "expired" ? "room-code-request-expired" : "room-code-rejected",
      { requestId },
    );
  }

  function registerRoomHash(roomId: string, shareHash: string, socketId: string): boolean {
    const trimmedHash = shareHash.trim();
    if (!trimmedHash || trimmedHash.length > 256) {
      return false;
    }

    const existingHash = roomHashes.get(roomId);
    if (!existingHash) {
      roomHashes.set(roomId, trimmedHash);
      return true;
    }

    if (existingHash === trimmedHash) {
      return true;
    }

    console.warn(
      `Socket ${socketId} attempted to supply conflicting hash for room ${roomId}`,
    );
    return false;
  }

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

    socket.on("join-room", (payload: { roomId: string; shareHash: string }) => {
      if (!payload || typeof payload.roomId !== "string" || typeof payload.shareHash !== "string") {
        socket.emit("room-hash-conflict");
        return;
      }

      const roomId = payload.roomId.trim();
      if (!roomId) {
        socket.emit("room-hash-conflict");
        return;
      }

      const didRegisterHash = registerRoomHash(roomId, payload.shareHash, socket.id);
      if (!didRegisterHash) {
        socket.emit("room-hash-conflict");
        return;
      }

      socket.join(roomId);
      socketRooms.get(socket.id)?.add(roomId);
      activeRooms.set(roomId, (activeRooms.get(roomId) || 0) + 1);
      emitRoomCode(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
      broadcastRoomCount(roomId);
      broadcastRoomList();
    });

    socket.on("leave-room", (roomId: string) => {
      socket.leave(roomId);
      socketRooms.get(socket.id)?.delete(roomId);
      const count = activeRooms.get(roomId) || 0;
      if (count <= 1) {
        activeRooms.delete(roomId);
        clearInactiveRoomMetadata(roomId);
      } else {
        activeRooms.set(roomId, count - 1);
        emitRoomCode(roomId);
      }
      console.log(`Socket ${socket.id} left room ${roomId}`);
      broadcastRoomCount(roomId);
      broadcastRoomList();
    });

    socket.on("request-join-by-code", (data: { code: string }) => {
      if (!data || typeof data.code !== "string") {
        socket.emit("room-code-request-error", { message: "请求无效，请重试" });
        return;
      }

      const code = data.code.trim();
      if (!/^\d{4}$/.test(code)) {
        socket.emit("room-code-request-error", { message: "请输入4位数字房间号" });
        return;
      }

      if (isRoomCodeJoinRateLimited(socket.id)) {
        socket.emit("room-code-request-error", { message: "请求过于频繁，请稍后再试" });
        return;
      }

      const roomId = codeToRoom.get(code);
      if (!roomId) {
        socket.emit("room-code-request-error", { message: "房间号不存在或已失效" });
        return;
      }

      if (!activeRooms.has(roomId) || getRoomMemberCount(roomId) <= 0) {
        socket.emit("room-code-request-error", { message: "房间暂时不可加入，请稍后再试" });
        return;
      }

      const shareHash = roomHashes.get(roomId);
      if (!shareHash) {
        socket.emit("room-code-request-error", { message: "房间暂时不可加入，请让对方重新打开分享链接" });
        return;
      }

      if (socketRooms.get(socket.id)?.has(roomId)) {
        socket.emit("room-code-request-error", { message: "你已在该房间中" });
        return;
      }

      const requestId = crypto.randomUUID();
      const expiresAt = Date.now() + ROOM_CODE_REQUEST_TTL_MS;
      const timeout = setTimeout(() => {
        rejectPendingRoomCodeRequest(requestId, "expired");
      }, ROOM_CODE_REQUEST_TTL_MS);

      pendingRoomCodeRequests.set(requestId, {
        requesterSocketId: socket.id,
        roomId,
        expiresAt,
        timeout,
      });

      socket.emit("room-code-request-pending", {
        requestId,
        expiresInMs: ROOM_CODE_REQUEST_TTL_MS,
      });

      io.to(roomId).emit("room-code-join-request", {
        requestId,
        requesterLabel: `设备 ${socket.id.slice(0, 6)}`,
        requestedAt: Date.now(),
      });
    });

    socket.on("approve-room-code-request", (data: { requestId: string }) => {
      if (!data || typeof data.requestId !== "string") {
        return;
      }

      const request = pendingRoomCodeRequests.get(data.requestId);
      if (!request) {
        return;
      }

      if (request.expiresAt <= Date.now()) {
        rejectPendingRoomCodeRequest(data.requestId, "expired");
        return;
      }

      if (!socketRooms.get(socket.id)?.has(request.roomId)) {
        console.warn(`Socket ${socket.id} attempted to approve request ${data.requestId} without room membership`);
        return;
      }

      const shareHash = roomHashes.get(request.roomId);
      if (!shareHash) {
        rejectPendingRoomCodeRequest(data.requestId, "expired");
        return;
      }

      clearTimeout(request.timeout);
      pendingRoomCodeRequests.delete(data.requestId);
      io.to(request.requesterSocketId).emit("room-code-approved", {
        requestId: data.requestId,
        shareHash,
      });
    });

    socket.on("reject-room-code-request", (data: { requestId: string }) => {
      if (!data || typeof data.requestId !== "string") {
        return;
      }

      const request = pendingRoomCodeRequests.get(data.requestId);
      if (!request) {
        return;
      }

      if (!socketRooms.get(socket.id)?.has(request.roomId)) {
        console.warn(`Socket ${socket.id} attempted to reject request ${data.requestId} without room membership`);
        return;
      }

      rejectPendingRoomCodeRequest(data.requestId, "rejected");
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
        for (const roomId of rooms) {
          // Decrement active room count
          const count = activeRooms.get(roomId) || 0;
          if (count <= 1) {
            activeRooms.delete(roomId);
            clearInactiveRoomMetadata(roomId);
          } else {
            activeRooms.set(roomId, count - 1);
            emitRoomCode(roomId);
          }
          // Use setTimeout to let socket.io finish cleanup first
          setTimeout(() => broadcastRoomCount(roomId), 50);
        }
      }
      socketRooms.delete(socket.id);
      messageRates.delete(socket.id);
      roomCodeJoinRates.delete(socket.id);

      for (const [requestId, request] of pendingRoomCodeRequests.entries()) {
        const requesterDisconnected = request.requesterSocketId === socket.id;
        const approverRoomBecameEmpty = !activeRooms.has(request.roomId);
        if (!requesterDisconnected && !approverRoomBecameEmpty) {
          continue;
        }

        if (requesterDisconnected) {
          clearTimeout(request.timeout);
          pendingRoomCodeRequests.delete(requestId);
          continue;
        }

        rejectPendingRoomCodeRequest(requestId, "expired");
      }

      broadcastRoomList();
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
    console.log(`Drop server running on ${protocol}://localhost:${PORT}`);
    console.log(`Drop server running on ${protocol}://${localIP}:${PORT}`);
  });
}

startServer();
