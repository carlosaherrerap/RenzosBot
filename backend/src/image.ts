// eslint-disable-next-line @typescript-eslint/no-var-requires
const Jimp: any = require("jimp");
import dayjs from "dayjs";

export async function generateStatusImage(order: {
  id: string;
  status: "RESERVADO" | "EN_PROCESO" | "TERMINADO";
  customer: { name: string; phone: string };
  total: number;
}) {
  const width = 800, height = 400;
  const colors: Record<typeof order.status, string> = {
    RESERVADO: "#1e40af",
    EN_PROCESO: "#a16207",
    TERMINADO: "#16a34a"
  };
  const image = new Jimp(width, height, colors[order.status]);
  const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fontText = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  image.print(fontTitle, 40, 40, `Pedido ${order.status}`);
  image.print(fontText, 40, 100, `Cliente: ${order.customer.name} (${order.customer.phone})`);
  image.print(fontText, 40, 130, `ID: ${order.id}`);
  image.print(fontText, 40, 160, `Total: S/ ${order.total.toFixed(2)}`);
  image.print(fontText, 40, 190, `Fecha: ${dayjs().format("YYYY-MM-DD HH:mm")}`);
  return await image.getBufferAsync(Jimp.MIME_PNG);
}

export async function generateReceiptImage(order: {
  id: string;
  customer: { name: string; phone: string };
  items: { product: { name: string }; quantity: number; price: any }[];
  total: number;
}) {
  const width = 800, height = 600;
  const image = new Jimp(width, height, "#0f172a");
  const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fontText = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  image.print(fontTitle, 40, 30, `Comprobante de Reserva`);
  image.print(fontText, 40, 80, `Cliente: ${order.customer.name} (${order.customer.phone})`);
  image.print(fontText, 40, 110, `ID: ${order.id}`);
  let y = 150;
  image.print(fontText, 40, y, `Items:`);
  y += 24;
  for (const it of order.items) {
    image.print(fontText, 60, y, `${it.quantity} x ${it.product.name} - S/ ${(Number(it.price) * it.quantity).toFixed(2)}`);
    y += 22;
  }
  y += 6;
  image.print(fontText, 40, y, `Total: S/ ${order.total.toFixed(2)}`);
  return await image.getBufferAsync(Jimp.MIME_PNG);
}
