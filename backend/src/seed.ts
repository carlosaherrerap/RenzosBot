import { prisma } from "./db.js";

async function run() {
  const products = [
    { name: "Torta de chocolate", category: "tortas", price: 45, available: true, imageUrl: "https://picsum.photos/id/1080/800/600" },
    { name: "Torta de vainilla", category: "tortas", price: 40, available: true, imageUrl: "https://picsum.photos/id/237/800/600" },
    { name: "Cupcake de chocolate", category: "reposteria", price: 5, available: true, imageUrl: "https://picsum.photos/id/433/800/600" },
    { name: "Pie de limón", category: "reposteria", price: 25, available: true, imageUrl: "https://picsum.photos/id/10/800/600" }
  ];
  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: p });
    } else {
      await prisma.product.create({ data: p });
    }
  }
  console.log("Seed completado");
}

run().finally(() => prisma.$disconnect());
