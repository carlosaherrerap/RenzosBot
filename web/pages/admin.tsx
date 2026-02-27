import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

type Order = {
  id: string;
  status: "RESERVADO" | "EN_PROCESO" | "TERMINADO";
  customer: { name: string; phone: string };
  items: { id: string; quantity: number; product: { name: string } }[];
};

const columns = ["RESERVADO", "EN_PROCESO", "TERMINADO"] as const;

export default function Admin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const grouped = useMemo(() => {
    const map: Record<string, Order[]> = { RESERVADO: [], EN_PROCESO: [], TERMINADO: [] };
    for (const o of orders) map[o.status].push(o);
    return map;
  }, [orders]);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        location.href = "/login";
        return;
      }
      const r = await fetch(`${api}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      setOrders(j);
    };
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const onDragEnd = async (result: DropResult) => {
    const { draggableId, destination, source } = result;
    if (!destination) return;
    const to = destination.droppableId as Order["status"];
    const from = source.droppableId as Order["status"];
    if (to === from) return;
    try {
      const token = localStorage.getItem("token")!;
      await fetch(`${api}/orders/${draggableId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: to })
      });
      setOrders(prev => prev.map(o => (o.id === draggableId ? { ...o, status: to } : o)));
    } catch {}
  };

  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "#0f172a", color: "#e5e7eb" }}>
      <h1 style={{ marginBottom: 16 }}>Tablero de Pedidos</h1>
      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, 1fr)" }}>
          {columns.map(col => (
            <Droppable droppableId={col} key={col}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{ background: "#1f2937", borderRadius: 8, padding: 12, minHeight: 400 }}
                >
                  <h2 style={{ marginBottom: 8 }}>{col}</h2>
                  {grouped[col].map((o, idx) => (
                    <Draggable draggableId={o.id} index={idx} key={o.id}>
                      {(prov) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          {...prov.dragHandleProps}
                          style={{
                            ...prov.draggableProps.style,
                            background: "#111827",
                            border: "1px solid #374151",
                            borderRadius: 8,
                            padding: 12,
                            marginBottom: 8
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{o.customer.name}</div>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>{o.customer.phone}</div>
                          <div style={{ marginTop: 6, fontSize: 13 }}>
                            {o.items.map(i => `${i.quantity}x ${i.product.name}`).join(", ")}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
