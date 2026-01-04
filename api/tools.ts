import { sql } from './_db';
import { Tool } from '../types';

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM "AI_Agent".tools ORDER BY created_at DESC`;
      const tools = rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        className: r.class_name,
        code: r.code,
        language: r.language,
        parameters: r.parameters
      }));
      return res.status(200).json(tools);
    } 
    
    if (req.method === 'POST') {
      const tool: Tool = req.body;
      await sql`
        INSERT INTO "AI_Agent".tools (id, name, description, class_name, code, parameters, language)
        VALUES (${tool.id}::UUID, ${tool.name}, ${tool.description}, ${tool.className}, ${tool.code}, ${JSON.stringify(tool.parameters)}, ${tool.language})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          class_name = EXCLUDED.class_name,
          code = EXCLUDED.code,
          parameters = EXCLUDED.parameters,
          language = EXCLUDED.language
      `;
      return res.status(200).json({ message: 'Tool saved successfully' });
    }
    
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ message: 'Tool ID is required' });
      await sql`DELETE FROM "AI_Agent".tools WHERE id = ${id}::UUID`;
      return res.status(200).json({ message: 'Tool deleted successfully' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Tool API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
