import { getAllData } from '../../lib/sheets';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const data = await getAllData();
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    return res.status(200).json(data);
  } catch(err) {
    console.error(err.message);
    return res.status(500).json({ error:'Falha ao buscar dados', detail:err.message });
  }
}
