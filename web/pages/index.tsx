import { useEffect, useState } from "react";
import QRCode from "qrcode.react";

export default function Home() {
  const [qr, setQr] = useState("");
  useEffect(() => {
    const load = async () => {
      const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const r = await fetch(`${url}/wa-qr`);
      const j = await r.json();
      setQr(j.qr || "");
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24 }}>
      <h1>Conectar WhatsApp</h1>
      {qr ? <QRCode value={qr} size={256} /> : <div>Esperando QR...</div>}
    </div>
  );
}
