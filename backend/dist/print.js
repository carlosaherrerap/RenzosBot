import os from "os";
import fs from "fs";
import path from "path";
import { generateTicketPDF } from "./pdf";
import { config } from "./config";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const printer = require("pdf-to-printer");
export async function printOrderTicket(order) {
    const pdf = await generateTicketPDF(order);
    const file = path.join(os.tmpdir(), `ticket-${order.id}.pdf`);
    await fs.promises.writeFile(file, pdf);
    const options = {};
    if (config.printerName)
        options.printer = config.printerName;
    await printer.print(file, options);
    try {
        await fs.promises.unlink(file);
    }
    catch { }
}
