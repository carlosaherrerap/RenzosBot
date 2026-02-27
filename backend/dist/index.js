import express from "express";
import cors from "cors";
import { config } from "./config";
import { startBot, getCurrentQR, sendTextToPhone, sendImageToPhone } from "./bot";
import { prisma } from "./db";
import { generateStatusImage, generateReceiptImage } from "./image";
import { generateTicketPDF } from "./pdf";
import { printOrderTicket } from "./print";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import axios from "axios";
const app = express();
app.use(express.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(cors());
app.get("/health", (_, res) => {
    res.json({ ok: true });
});
app.get("/wa-qr", (_, res) => {
    res.json({ qr: getCurrentQR() });
});
function auth(req, res, next) {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
    if (!token)
        return res.status(401).json({ error: "no auth" });
    try {
        jwt.verify(token, config.jwtSecret);
        next();
    }
    catch {
        res.status(401).json({ error: "invalid token" });
    }
}
app.post("/auth/login", (req, res) => {
    const { user, password } = req.body;
    if (user !== config.adminUser || password !== config.adminPassword)
        return res.status(401).json({ error: "invalid credentials" });
    const token = jwt.sign({ role: "admin" }, config.jwtSecret, { expiresIn: "12h" });
    res.json({ token });
});
app.get("/orders", async (_, res) => {
    const orders = await prisma.order.findMany({
        include: { customer: true, items: { include: { product: true } } },
        orderBy: { createdAt: "desc" }
    });
    res.json(orders);
});
app.get("/products", async (_, res) => {
    const products = await prisma.product.findMany({ where: { available: true } });
    res.json(products);
});
app.post("/orders/reserve", async (req, res) => {
    try {
        const { phone, name, items } = req.body;
        if (!phone || !items?.length)
            return res.status(400).json({ error: "phone y items requeridos" });
        const customer = await prisma.customer.upsert({
            where: { phone },
            update: { name: name || phone },
            create: { phone, name: name || phone }
        });
        const prods = await prisma.product.findMany({ where: { id: { in: items.map(i => i.productId) } } });
        const total = items.reduce((sum, it) => {
            const p = prods.find(pr => pr.id === it.productId);
            return sum + (p ? Number(p.price) * it.quantity : 0);
        }, 0);
        const order = await prisma.order.create({
            data: {
                customerId: customer.id,
                status: "RESERVADO",
                total,
                items: {
                    create: items.map(it => {
                        const p = prods.find(pr => pr.id === it.productId);
                        return { productId: it.productId, quantity: it.quantity, price: p.price };
                    })
                }
            },
            include: { items: true, customer: true }
        });
        try {
            const img = await generateReceiptImage({
                id: order.id,
                customer: order.customer,
                items: order.items.map(i => ({ product: { name: prods.find(p => p.id === i.productId)?.name || "" }, quantity: i.quantity, price: i.price })),
                total: Number(order.total)
            });
            await sendImageToPhone(order.customer.phone, img, "Comprobante de Reserva");
        }
        catch { }
        res.json(order);
    }
    catch (e) {
        res.status(500).json({ error: "error reservando pedido" });
    }
});
app.post("/orders/:id/status", auth, async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    if (!id || !status)
        return res.status(400).json({ error: "id y status requeridos" });
    const order = await prisma.order.update({ where: { id }, data: { status }, include: { customer: true } });
    const phone = order.customer.phone;
    try {
        const statusImg = await generateStatusImage({
            id: order.id,
            status,
            customer: order.customer,
            total: Number(order.total)
        });
        await sendImageToPhone(phone, statusImg, `Pedido ${status}`);
    }
    catch { }
    if (status === "TERMINADO") {
        await sendTextToPhone(phone, "Tu pedido ya está listo. ¡Gracias por tu preferencia!");
    }
    else if (status === "EN_PROCESO") {
        await sendTextToPhone(phone, "Tu pedido ha pasado a EN PROCESO.");
    }
    else if (status === "RESERVADO") {
        await sendTextToPhone(phone, "Tu pedido ha sido RESERVADO.");
    }
    res.json(order);
});
app.post("/payments/yape/webhook", async (req, res) => {
    const sig = req.headers["x-yape-signature"] || "";
    if (config.yapeWebhookSecret) {
        const expected = crypto.createHmac("sha256", config.yapeWebhookSecret).update(req.rawBody || "").digest("hex");
        if (expected !== sig)
            return res.status(401).json({ error: "firma inválida" });
    }
    const { orderId, paymentRef } = req.body;
    if (!orderId)
        return res.status(400).json({ error: "orderId requerido" });
    const order = await prisma.order.update({
        where: { id: orderId },
        data: { paid: true, paymentRef: paymentRef || null },
        include: { customer: true }
    });
    await sendTextToPhone(order.customer.phone, "Pago recibido vía Yape. ¡Gracias!");
    try {
        await printOrderTicket({
            id: order.id,
            customer: order.customer,
            items: (await prisma.orderItem.findMany({ where: { orderId }, include: { product: true } }))
                .map(i => ({ product: i.product, quantity: i.quantity, price: i.price })),
            total: Number(order.total)
        });
    }
    catch { }
    res.json({ ok: true });
});
app.get("/orders/:id/ticket.pdf", async (req, res) => {
    const id = req.params.id;
    const order = await prisma.order.findUnique({
        where: { id },
        include: { customer: true, items: { include: { product: true } } }
    });
    if (!order)
        return res.status(404).end();
    const pdf = await generateTicketPDF({
        id: order.id,
        customer: order.customer,
        items: order.items.map(i => ({ product: i.product, quantity: i.quantity, price: i.price })),
        total: Number(order.total)
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="ticket-${order.id}.pdf"`);
    res.send(pdf);
});
app.get("/metrics/summary", auth, async (req, res) => {
    const { from, to } = req.query;
    const where = {};
    if (from || to)
        where.createdAt = {};
    if (from)
        where.createdAt.gte = new Date(from);
    if (to)
        where.createdAt.lte = new Date(to);
    const totalOrders = await prisma.order.count({ where });
    const reservado = await prisma.order.count({ where: { ...where, status: "RESERVADO" } });
    const enProceso = await prisma.order.count({ where: { ...where, status: "EN_PROCESO" } });
    const terminado = await prisma.order.count({ where: { ...where, status: "TERMINADO" } });
    res.json({ totalOrders, reservado, enProceso, terminado });
});
app.get("/metrics/orders-by-day", auth, async (req, res) => {
    const { days } = req.query;
    const n = Number(days || 7);
    const since = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    const orders = await prisma.order.findMany({ where: { createdAt: { gte: since } } });
    const map = {};
    for (const o of orders) {
        const d = o.createdAt.toISOString().slice(0, 10);
        map[d] = (map[d] || 0) + 1;
    }
    const labels = Object.keys(map).sort();
    const data = labels.map(l => map[l]);
    res.json({ labels, data });
});
app.post("/vision/index-images", auth, async (_req, res) => {
    try {
        const r = await axios.post(`${config.visionUrl}/index-images-from-backend`, {});
        res.json(r.data);
    }
    catch {
        res.status(500).json({ error: "vision no disponible" });
    }
});
app.post("/vision/similar-image", auth, async (req, res) => {
    try {
        const r = await axios.post(`${config.visionUrl}/similar-image`, req.body);
        res.json(r.data);
    }
    catch {
        res.status(500).json({ items: [] });
    }
});
app.post("/vision/similar", auth, async (req, res) => {
    try {
        const r = await axios.post(`${config.visionUrl}/similar`, req.body);
        res.json(r.data);
    }
    catch {
        res.status(500).json({ items: [] });
    }
});
app.listen(config.port, () => { });
startBot();
