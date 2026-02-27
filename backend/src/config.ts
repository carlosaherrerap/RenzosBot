import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || "",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  authDir: process.env.BAILEYS_AUTH_DIR || "./session",
  sttUrl: process.env.STT_URL || "http://localhost:8002",
  visionUrl: process.env.VISION_URL || "http://localhost:8001",
  printerName: process.env.PRINTER_NAME || "",
  yapeWebhookSecret: process.env.YAPE_WEBHOOK_SECRET || "",
  adminUser: process.env.ADMIN_USER || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "admin",
  jwtSecret: process.env.JWT_SECRET || "secret"
};
