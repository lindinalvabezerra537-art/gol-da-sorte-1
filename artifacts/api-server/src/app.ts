import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.get("/api", (_req, res) => { res.json({ status: "ok" }); });

// SSE (Server-Sent Events) para notificações em tempo real
const clients = new Map<number, Response>();
app.get("/api/events", (req, res) => {
  const userId = parseInt(req.query.userId as string);
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  clients.set(userId, res);
  req.on("close", () => { clients.delete(userId); });
});

export function sendEvent(userId: number, event: { type: string; data: unknown }) {
  const client = clients.get(userId);
  if (client) {
    client.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

/** Envia um evento para TODOS os clientes conectados (broadcast) */
export function broadcastEvent(event: { type: string; data: unknown }) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const [, client] of clients) {
    try {
      client.write(payload);
    } catch {
      // ignora clientes desconectados
    }
  }
}

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

export default app;
