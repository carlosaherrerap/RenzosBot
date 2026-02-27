import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, WAMessageContent, downloadContentFromMessage } from "@whiskeysockets/baileys";
import { config } from "./config.js";
import { prisma } from "./db.js";
import fs from "fs";
import axios from "axios";
import { getIntelligentResponse } from "./llm.js";
import { generateReceiptImage } from "./image.js";
import { printOrderTicket } from "./print.js";

type Mode = "text" | "audio";
interface UserState {
  mode: Mode;
  lastCategory?: string;
  offset: number;
}
const userStates = new Map<string, UserState>();

let lastQR = "";
export const getCurrentQR = () => lastQR;
let sockRef: ReturnType<typeof makeWASocket> | null = null;

export async function sendTextToPhone(jid: string, text: string) {
  if (!sockRef) return;
  await sockRef.sendMessage(jid, { text });
}

export async function sendImageToPhone(jid: string, image: Buffer, caption?: string) {
  if (!sockRef) return;
  await sockRef.sendMessage(jid, { image, caption });
}

export async function startBot() {
  const authDir = config.authDir;
  fs.mkdirSync(authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });
  sockRef = sock;

  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) lastQR = qr;
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== 401;
      console.log(`[Bot] Conexión cerrada. Reconectando: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(() => startBot(), 5000);
      }
    } else if (connection === "open") {
      console.log("[Bot] Conexión abierta con éxito");
      lastQR = "";
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const jid = msg.key.remoteJid || "";
    const phone = jid.split("@")[0];
    const text = extractText(msg.message);
    if (!text) return;

    console.log(`[Bot] Mensaje de ${jid}: ${text}`);

    if (msg.message.audioMessage) {
      const stream = await downloadContentFromMessage(msg.message.audioMessage, "audio");
      const chunks: Buffer[] = [];
      for await (const c of stream) chunks.push(c);
      const buf = Buffer.concat(chunks);
      const r = await axios.post(`${config.sttUrl}/transcribe`, { audio_base64: buf.toString("base64") });
      const audioText = (r.data?.text as string) || "";
      if (audioText) {
        await handleIncomingText(jid, phone, audioText, msg);
      } else {
        const uState = userStates.get(jid) || { mode: "text" as Mode, offset: 0 };
        await respondWithMode(jid, uState.mode, "No pude entender el audio, ¿puedes repetir?");
      }
      return;
    }

    await handleIncomingText(jid, phone, text, msg);
  });
}

async function handleIncomingText(jid: string, phone: string, text: string, msg: any) {
  const state = userStates.get(jid) || { mode: "text" as Mode, offset: 0 };
  userStates.set(jid, state);

  const low = text.toLowerCase();

  if (low.startsWith("audio x")) {
    state.mode = "audio";
    await sockRef?.sendMessage(jid, { text: "Preferencia cambiada a audio" });
    await prisma.customer.upsert({
      where: { phone },
      update: { responseMode: "AUDIO" },
      create: { phone, name: phone, responseMode: "AUDIO" }
    });
    return;
  }
  if (low.startsWith("texto x")) {
    state.mode = "text";
    await sockRef?.sendMessage(jid, { text: "Preferencia cambiada a texto" });
    await prisma.customer.upsert({
      where: { phone },
      update: { responseMode: "TEXT" },
      create: { phone, name: phone, responseMode: "TEXT" }
    });
    return;
  }

  // Comandos de paginación manual
  if (low.includes("ver mas") || low.includes("ver más")) {
    if (state.lastCategory) {
      state.offset += 3;
      await listProducts(jid, state.lastCategory, state.offset);
      return;
    }
  }

  // Keyword: Precio
  if (low.includes("precio")) {
    const nameGuess = low.replace("precio de", "").replace("precio", "").trim();
    if (nameGuess) {
      const p = await prisma.product.findFirst({
        where: { name: { contains: nameGuess, mode: "insensitive" }, available: true }
      });
      if (p) {
        await respondWithMode(jid, state.mode, `El precio de ${p.name} es S/ ${p.price}`);
        return;
      }
    }
  }

  // Imagen: Visión
  if (msg.message.imageMessage) {
    const stream = await downloadContentFromMessage(msg.message.imageMessage, "image");
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c);
    const buf = Buffer.concat(chunks);
    try {
      const sim = await axios.post(`${config.visionUrl}/similar-image`, { image_base64: buf.toString("base64"), top_k: 4 });
      const items = sim.data?.items || [];
      if (items.length > 0) {
        const principal = items[0];
        const otros = items.slice(1).map((i: any) => i.name).join(", ");
        await respondWithMode(jid, state.mode, `Te recomiendo: ${principal.name}. Otras opciones: ${otros}`);
        return;
      }
    } catch { }
    await respondWithMode(jid, state.mode, "No encontré coincidencias con la imagen.");
    return;
  }

  // Consultar IA para respuesta inteligente
  console.log(`[Bot] Consultando IA para: ${text}`);
  const intelligentReply = await getIntelligentResponse(text);

  if (intelligentReply) {
    console.log(`[Bot] Respuesta IA: ${intelligentReply}`);

    // COMANDO: LISTAR PRODUCTOS
    if (intelligentReply.includes("[LISTAR_PRODUCTOS:")) {
      const match = intelligentReply.match(/\[LISTAR_PRODUCTOS:\s*(.*?)\]/);
      const category = match ? match[1].trim() : "todos";
      state.lastCategory = category;
      state.offset = 0;

      const cleanReply = intelligentReply.replace(/\[LISTAR_PRODUCTOS:.*\]/, "").trim();
      if (cleanReply) await respondWithMode(jid, state.mode, cleanReply);

      await listProducts(jid, category, 0);
      return;
    }

    // COMANDO: CREAR ORDEN
    if (intelligentReply.includes("[CREAR_ORDEN:")) {
      const match = intelligentReply.match(/\[CREAR_ORDEN:\s*(.*?)\]/);
      if (match) {
        const orderDetails = match[1];
        await createAndSendOrder(jid, phone, orderDetails, intelligentReply, state.mode);
        return;
      }
    }

    await respondWithMode(jid, state.mode, intelligentReply);
  } else {
    await respondWithMode(jid, state.mode, "Hola, ¿en qué puedo ayudar?");
  }
}

async function listProducts(jid: string, category: string, offset: number) {
  const where: any = { available: true };
  if (category !== "todos") {
    where.category = { contains: category, mode: "insensitive" };
  }

  const products = await prisma.product.findMany({
    where,
    take: 3,
    skip: offset,
    orderBy: { createdAt: "desc" }
  });

  if (products.length === 0) {
    await sendTextToPhone(jid, offset === 0 ? "Por ahora no tenemos productos en esa categoría." : "No hay más productos por mostrar.");
    return;
  }

  for (const p of products) {
    const caption = `*${p.name}*\nS/ ${Number(p.price).toFixed(2)}`;
    if (p.imageUrl) {
      try {
        const res = await axios.get(p.imageUrl, { responseType: "arraybuffer" });
        await sendImageToPhone(jid, Buffer.from(res.data), caption);
      } catch {
        await sendTextToPhone(jid, caption);
      }
    } else {
      await sendTextToPhone(jid, caption);
    }
  }

  if (products.length === 3) {
    await sendTextToPhone(jid, 'Escribe "Ver más" para ver más opciones.');
  }
}

async function createAndSendOrder(jid: string, phone: string, details: string, aiText: string, mode: Mode) {
  const cleanReply = aiText.replace(/\[CREAR_ORDEN:.*\]/, "").trim();
  if (cleanReply) await respondWithMode(jid, mode, cleanReply);

  const itemsParts = details.split(",").map(i => i.trim());
  const customer = await prisma.customer.upsert({
    where: { phone },
    update: { name: phone },
    create: { phone, name: phone }
  });

  let totalValue = 0;
  const orderItemsData = [];

  for (const part of itemsParts) {
    const qtyMatch = part.match(/\((.*?)\)/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    const productName = part.replace(/\(.*?\)/, "").trim();

    const p = await prisma.product.findFirst({
      where: { name: { contains: productName, mode: "insensitive" } }
    });

    if (p) {
      totalValue += Number(p.price) * quantity;
      orderItemsData.push({
        productId: p.id,
        quantity,
        price: p.price
      });
    }
  }

  if (orderItemsData.length === 0) {
    await sendTextToPhone(jid, "Lo siento, no pude identificar los productos para la reserva.");
    return;
  }

  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      status: "RESERVADO",
      total: totalValue,
      items: {
        create: orderItemsData
      }
    },
    include: {
      items: { include: { product: true } },
      customer: true
    }
  });

  const ticketImg = await generateReceiptImage({
    id: order.id,
    customer: { name: customer.name, phone: customer.phone },
    items: order.items,
    total: Number(order.total)
  });

  await sendImageToPhone(jid, ticketImg, `¡Listo! Aquí tienes tu ticket de reserva #${order.id}`);

  console.log(`[Bot] Orden creada: ${order.id}. Imprimiendo...`);
  try {
    await printOrderTicket({
      id: order.id,
      customer: { name: customer.name, phone: customer.phone },
      items: order.items.map(i => ({ product: { name: i.product.name }, quantity: i.quantity, price: i.price })),
      total: Number(order.total)
    });
  } catch (err) {
    console.error("Error al imprimir:", err);
  }
}

function extractText(content: WAMessageContent): string | null {
  if (!content) return null;
  const t =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.templateButtonReplyMessage?.selectedId ||
    content.buttonsResponseMessage?.selectedButtonId ||
    null;
  return t;
}

async function synthAudio(text: string): Promise<Buffer> {
  const url = `${config.sttUrl}/tts`;
  const r = await axios.post(url, { text });
  const b64: string = r.data.audio_base64;
  return Buffer.from(b64, "base64");
}

async function respondWithMode(jid: string, mode: Mode, text: string) {
  if (!sockRef) return;
  console.log(`[Bot] Enviando respuesta a ${jid}: ${text.substring(0, 50)}...`);
  try {
    if (mode === "audio") {
      try {
        const audioBuf = await synthAudio(text);
        await sockRef.sendMessage(jid, { audio: audioBuf, mimetype: "audio/mpeg" }, { ephemeralExpiration: 604800 });
      } catch (err) {
        console.error("Error TTS fallback to text:", err);
        await sockRef.sendMessage(jid, { text }, { ephemeralExpiration: 604800 });
      }
    } else {
      await sockRef.sendMessage(jid, { text }, { ephemeralExpiration: 604800 });
    }
  } catch (err) {
    console.error(`[Bot] Error enviando mensaje a ${jid}:`, err);
  }
}
