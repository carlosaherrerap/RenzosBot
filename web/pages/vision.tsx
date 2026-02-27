import { useEffect, useState } from "react";

type Item = { id: string; name: string; score: number };

export default function Vision() {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const [status, setStatus] = useState<string>("");
  const [textQuery, setTextQuery] = useState("");
  const [textResults, setTextResults] = useState<Item[]>([]);
  const [imageResults, setImageResults] = useState<Item[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) location.href = "/login";
  }, []);

  const indexImages = async () => {
    const token = localStorage.getItem("token")!;
    setStatus("Indexando...");
    try {
      const r = await fetch(`${api}/vision/index-images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json();
      setStatus(`Indexadas: ${j.count ?? 0}`);
    } catch {
      setStatus("Error indexando");
    }
  };

  const runText = async () => {
    const token = localStorage.getItem("token")!;
    try {
      const r = await fetch(`${api}/vision/similar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: textQuery, top_k: 5 })
      });
      const j = await r.json();
      setTextResults(j.items || []);
    } catch {
      setTextResults([]);
    }
  };

  const runImage = async (file: File) => {
    const token = localStorage.getItem("token")!;
    const buf = await file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    try {
      const r = await fetch(`${api}/vision/similar-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image_base64: b64, top_k: 5 })
      });
      const j = await r.json();
      setImageResults(j.items || []);
    } catch {
      setImageResults([]);
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "#0f172a", color: "#e5e7eb" }}>
      <h1 style={{ marginBottom: 16 }}>Visión</h1>
      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ background: "#1f2937", borderRadius: 8, padding: 16 }}>
          <h2>Indexar imágenes desde backend</h2>
          <button onClick={indexImages} style={{ padding: 8, background: "#2563eb", color: "#fff", borderRadius: 6 }}>Indexar</button>
          <div style={{ marginTop: 8 }}>{status}</div>
          <h3 style={{ marginTop: 16 }}>Búsqueda por texto</h3>
          <input value={textQuery} onChange={e => setTextQuery(e.target.value)} style={{ width: "100%", marginTop: 6 }} />
          <button onClick={runText} style={{ marginTop: 8, padding: 8, background: "#10b981", color: "#fff", borderRadius: 6 }}>Buscar</button>
          <ul style={{ marginTop: 12 }}>
            {textResults.map(it => (
              <li key={it.id}>{it.name} ({it.score.toFixed(2)})</li>
            ))}
          </ul>
        </div>
        <div style={{ background: "#1f2937", borderRadius: 8, padding: 16 }}>
          <h2>Buscar por imagen</h2>
          <input type="file" accept="image/*" onChange={e => e.target.files && runImage(e.target.files[0])} />
          <ul style={{ marginTop: 12 }}>
            {imageResults.map(it => (
              <li key={it.id}>{it.name} ({it.score.toFixed(2)})</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
