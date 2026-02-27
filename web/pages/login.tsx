import { useState } from "react";
import Router from "next/router";

export default function Login() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const r = await fetch(`${api}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "error");
      localStorage.setItem("token", j.token);
      Router.push("/admin");
    } catch (err: any) {
      setError(err.message || "error");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f172a", color: "#e5e7eb" }}>
      <form onSubmit={submit} style={{ background: "#1f2937", padding: 24, borderRadius: 8, width: 360 }}>
        <h1 style={{ marginBottom: 12 }}>Login Admin</h1>
        <div style={{ marginBottom: 8 }}>
          <label>Usuario</label>
          <input value={user} onChange={e => setUser(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%" }} />
        </div>
        {error && <div style={{ color: "#ef4444", marginBottom: 8 }}>{error}</div>}
        <button type="submit" style={{ width: "100%", padding: 8, background: "#2563eb", color: "#fff", borderRadius: 6 }}>Entrar</button>
      </form>
    </div>
  );
}
