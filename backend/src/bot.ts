import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, WAMessageContent, downloadContentFromMessage } from "@whiskeysockets/baileys";
import { config } from "./config.js";
import { prisma } from "./db.js";
import fs from "fs";
import axios from "axios";

type Mode = "text" | "audio";
const userModes = new Map<string, Mode>();

let lastQR = "";
export const getCurrentQR = () => lastQR;
let sockRef: ReturnType<typeof makeWASocket> | null = null;
export async function sendTextToPhone(phone: string, text: string) {
  const jid = `${phone}@s.whatsapp.net`;
  if (!sockRef) return;
  await sockRef.sendMessage(jid, { text });
}

export async function sendImageToPhone(phone: string, image: Buffer, caption?: string) {
  const jid = `${phone}@s.whatsapp.net`;
  if (!sockRef) return;
  await sockRef.sendMessage(jid, { image, caption });
}

export async function startBot() {
  const authDir = config.authDir;
  fs.mkdirSync(authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, printQRInTerminal: false });
  sockRef = sock;

  sock.ev.on("connection.update", (u) => {
    const qr = u.qr;
    if (qr) lastQR = qr;
    const connection = u.connection;
    if (connection === "close") {
      startBot();
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid || "";
    const phone = jid.split("@")[0];
    if (msg.message.audioMessage) {
      const stream = await downloadContentFromMessage(msg.message.audioMessage, "audio");
      const chunks: Buffer[] = [];
      for await (const c of stream) chunks.push(c);
      const buf = Buffer.concat(chunks);
      const r = await axios.post(`${config.sttUrl}/transcribe`, { audio_base64: buf.toString("base64") });
      const text = (r.data?.text as string) || "";
      if (text) {
        await respondWithMode(jid, userModes.get(jid) || "text", text);
      } else {
        await respondWithMode(jid, userModes.get(jid) || "text", "No pude entender el audio, ¿puedes repetir?");
      }
      return;
    }
    const text = extractText(msg.message);
    if (!text) return;
    if (text.toLowerCase().startsWith("audio x")) {
      userModes.set(jid, "audio");
      await sock.sendMessage(jid, { text: "Preferencia cambiada a audio" });
      await prisma.customer.upsert({
        where: { phone },
        update: { responseMode: "AUDIO" },
        create: { phone, name: phone, responseMode: "AUDIO" }
      });
      return;
    }
    if (text.toLowerCase().startsWith("texto x")) {
      userModes.set(jid, "text");
      await sock.sendMessage(jid, { text: "Preferencia cambiada a texto" });
      await prisma.customer.upsert({
        where: { phone },
        update: { responseMode: "TEXT" },
        create: { phone, name: phone, responseMode: "TEXT" }
      });
      return;
    }
    const mode = userModes.get(jid) || "text";
    const low = text.toLowerCase();
    if (low.includes("precio")) {
      const nameGuess = low.replace("precio de", "").replace("precio", "").trim();
      if (nameGuess) {
        const p = await prisma.product.findFirst({
          where: { name: { contains: nameGuess, mode: "insensitive" }, available: true }
        });
        if (p) {
          const reply = `El precio de ${p.name} es S/ ${p.price}`;
          await respondWithMode(jid, mode, reply);
          return;
        }
      }
      const reply = "No encontré el producto, ¿puedes escribir el nombre completo?";
      await respondWithMode(jid, mode, reply);
      return;
    }
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
          const reply = `Te recomiendo: ${principal.name}. Otras opciones: ${otros}`;
          await respondWithMode(jid, mode, reply);
          return;
        }
      } catch { }
      await respondWithMode(jid, mode, "No encontré coincidencias con la imagen.");
      return;
    }
    if (low.includes("parecido a") || low.startsWith("busco") || low.startsWith("buscar")) {
      const q = low.replace("parecido a", "").replace("busco", "").replace("buscar", "").trim();
      try {
        const sim = await axios.post(`${config.visionUrl}/similar`, { query: q, top_k: 4 });
        const items = sim.data?.items || [];
        if (items.length > 0) {
          const principal = items[0];
          const otros = items.slice(1).map((i: any) => i.name).join(", ");
          const reply = `Te recomiendo: ${principal.name}. Otras opciones: ${otros}`;
          await respondWithMode(jid, mode, reply);
          return;
        }
      } catch { }
      await respondWithMode(jid, mode, "No encontré coincidencias, ¿puedes describir mejor lo que buscas?");
      return;
    }
    if (low.includes("pedido") && low.includes("listo")) {
      const reply = "Cuando tu pedido cambie a TERMINADO te avisaré aquí mismo.";
      await respondWithMode(jid, mode, reply);
      return;
    }
    await respondWithMode(jid, mode, "Hola, ¿en qué puedo ayudar?");
  });
}

function extractText(content: WAMessageContent): string | null {
  const t =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
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
  if (mode === "audio") {
    const audioBuf = await synthAudio(text);
    await sockRef?.sendMessage(jid, { audio: audioBuf, mimetype: "audio/mpeg" });
  } else {
    await sockRef?.sendMessage(jid, { text });
  }
}
