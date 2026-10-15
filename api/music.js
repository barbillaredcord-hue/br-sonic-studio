const MODEL = "fal-ai/minimax-music/v2.6";
const BASE = "https://queue.fal.run/" + MODEL;
const HEADERS = () => ({ Authorization: "Key " + process.env.FAL_KEY, "Content-Type": "application/json" });
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!process.env.FAL_KEY || !process.env.BR_SONIC_ADMIN_PIN) return res.status(503).json({ error: "Servicio no configurado" });
  const crypto = require("node:crypto");
  const expected = Buffer.from(process.env.BR_SONIC_ADMIN_PIN);
  const provided = Buffer.from(String(req.headers["x-br-admin"] || ""));
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return res.status(401).json({ error: "Acceso denegado" });
  const body = req.body || {};
  try {
    if (body.action === "submit") {
      const prompt = String(body.prompt || "").trim().slice(0, 2000);
      const instrumental = body.instrumental === true;
      const lyrics = instrumental ? "" : String(body.lyrics || "").trim().slice(0, 3500);
      if (prompt.length < 10) return res.status(400).json({ error: "Describe la música en al menos 10 caracteres" });
      const response = await fetch(BASE, { method: "POST", headers: HEADERS(), body: JSON.stringify({ prompt, lyrics, is_instrumental: instrumental, lyrics_optimizer: !instrumental && !lyrics }) });
      if (!response.ok) return res.status(502).json({ error: "El proveedor rechazó la solicitud", providerStatus: response.status });
      const result = await response.json();
      if (!result.request_id) return res.status(502).json({ error: "El proveedor no devolvió identificador" });
      return res.status(202).json({ requestId: result.request_id });
    }
    if (body.action === "status" || body.action === "result") {
      const requestId = String(body.requestId || "");
      if (!/^[a-zA-Z0-9-]{8,100}$/.test(requestId)) return res.status(400).json({ error: "Identificador inválido" });
      const url = BASE + "/requests/" + requestId + (body.action === "status" ? "/status" : "");
      const response = await fetch(url, { headers: HEADERS() });
      if (!response.ok) return res.status(502).json({ error: "Error consultando al proveedor", providerStatus: response.status });
      const data = await response.json();
      if (body.action === "status") return res.status(200).json({ status: data.status });
      return res.status(200).json({ audioUrl: data.audio?.url || null });
    }
    return res.status(400).json({ error: "Acción desconocida" });
  } catch (error) {
    return res.status(502).json({ error: "No fue posible comunicarse con el proveedor" });
  }
};
