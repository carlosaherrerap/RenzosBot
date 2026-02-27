import PDFDocument from "pdfkit";
export async function generateTicketPDF(order) {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (d) => chunks.push(d));
    const done = new Promise((resolve) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
    });
    doc.fontSize(20).text("Comprobante de Reserva", { align: "left" });
    doc.moveDown();
    doc.fontSize(12).text(`Cliente: ${order.customer.name} (${order.customer.phone})`);
    doc.text(`ID: ${order.id}`);
    doc.moveDown();
    doc.text("Items:");
    doc.moveDown(0.5);
    for (const it of order.items) {
        doc.text(`${it.quantity} x ${it.product.name} - S/ ${(Number(it.price) * it.quantity).toFixed(2)}`);
    }
    doc.moveDown();
    doc.fontSize(14).text(`Total: S/ ${order.total.toFixed(2)}`);
    doc.end();
    return await done;
}
