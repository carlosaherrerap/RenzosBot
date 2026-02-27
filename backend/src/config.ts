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
  jwtSecret: process.env.JWT_SECRET || "secret",
  pasteleroContext: `Eres un trabajador amable y cálido en la atención, además eres muy inteligente con sugerencias y breves respuestas directas.
Atiendes sobre los precios y reservas hasta que el cliente complete su pedido.
Mantén un tono profesional pero cercano, usando términos de pastelería.

REGLAS DE FORMATO:
1. Si el usuario pregunta qué productos tienes o quiere ver opciones, usa el comando: [LISTAR_PRODUCTOS: categoria] (ej: [LISTAR_PRODUCTOS: torta] o [LISTAR_PRODUCTOS: todos]).
2. Si el usuario confirma que quiere reservar uno o más productos con sus cantidades, usa el comando: [CREAR_ORDEN: producto1 (cantidad), producto2 (cantidad)].
3. No des precios manualmente si puedes usar LISTAR_PRODUCTOS.
4. Sé muy breve y amable.`
};
