import { useEffect, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { Chart, BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend } from "chart.js";

Chart.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

export default function Dashboard() {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const [summary, setSummary] = useState({ totalOrders: 0, reservado: 0, enProceso: 0, terminado: 0 });
  const [series, setSeries] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        location.href = "/login";
        return;
      }
      const s = await fetch(`${api}/metrics/summary`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      const o = await fetch(`${api}/metrics/orders-by-day?days=14`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      setSummary(s);
      setSeries(o);
    };
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "#0f172a", color: "#e5e7eb" }}>
      <h1 style={{ marginBottom: 16 }}>Dashboard</h1>
      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ background: "#1f2937", borderRadius: 8, padding: 16 }}>
          <h2>Pedidos por día</h2>
          <Bar
            data={{
              labels: series.labels,
              datasets: [{ label: "Pedidos", data: series.data, backgroundColor: "#60a5fa" }]
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
        </div>
        <div style={{ background: "#1f2937", borderRadius: 8, padding: 16 }}>
          <h2>Estados</h2>
          <Doughnut
            data={{
              labels: ["Reservado", "En proceso", "Terminado"],
              datasets: [{
                data: [summary.reservado, summary.enProceso, summary.terminado],
                backgroundColor: ["#1e40af", "#a16207", "#16a34a"]
              }]
            }}
            options={{ responsive: true }}
          />
          <div style={{ marginTop: 12, fontSize: 14 }}>Total pedidos: {summary.totalOrders}</div>
        </div>
      </div>
    </div>
  );
}
