import { sql } from './_db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const [domainsRes, fileExtensionsRes, enginesRes, modelsRes] = await Promise.all([
      sql`SELECT name FROM "AI_Agent".domains ORDER BY name ASC`,
      sql`SELECT * FROM "AI_Agent".file_extensions ORDER BY name ASC`,
      sql`SELECT id, name, description, is_active FROM "AI_Agent".ai_engines ORDER BY name ASC`, // API keys are NOT exposed
      sql`SELECT * FROM "AI_Agent".models ORDER BY name ASC`
    ]);

    const lookups = {
      domains: domainsRes.map(r => r.name),
      fileExtensions: fileExtensionsRes.map(r => ({ id: r.id, name: r.name, extension: r.extension })),
      engines: enginesRes.map(r => ({ id: r.id, name: r.name, description: r.description, is_active: r.is_active })),
      models: modelsRes.map(r => ({
        id: r.id,
        engine_id: Number(r.engine_id),
        name: r.name,
        full_name: r.full_name,
        max_tokens: Number(r.max_tokens),
        is_active: r.is_active
      }))
    };

    return res.status(200).json(lookups);
  } catch (error) {
    console.error('Lookups API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
