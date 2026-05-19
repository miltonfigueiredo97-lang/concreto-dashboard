/**
 * pages/api/data.js
 * Endpoint único que retorna todos os dados do Google Sheets.
 * O frontend chama GET /api/data e recebe { pecas, concretagens, lancamentos }.
 *
 * Usamos a rota de API para não expor a API Key no bundle do cliente
 * (mesmo sendo NEXT_PUBLIC_, centralizar aqui facilita cache e erros).
 */

import { getAllData } from "../../lib/sheets";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = await getAllData();

    // Cache de 30 segundos no CDN da Vercel
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(data);
  } catch (err) {
    console.error("Sheets API error:", err.message);
    return res.status(500).json({
      error: "Falha ao buscar dados do Google Sheets",
      detail: err.message,
    });
  }
}
