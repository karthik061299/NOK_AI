import { sql } from './_db';
import { Workflow } from '../types';

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM "AI_Agent".workflows ORDER BY created_at DESC`;
      const workflows = rows.map(row => ({
        metadata: row.metadata,
        nodes: row.nodes,
        edges: row.edges
      }));
      return res.status(200).json(workflows);
    } 
    
    if (req.method === 'POST') {
      const workflow: Workflow = req.body;
      await sql`
        INSERT INTO "AI_Agent".workflows (id, metadata, nodes, edges)
        VALUES (${workflow.metadata.id}::UUID, ${JSON.stringify(workflow.metadata)}, ${JSON.stringify(workflow.nodes)}, ${JSON.stringify(workflow.edges)})
        ON CONFLICT (id) DO UPDATE SET
          metadata = EXCLUDED.metadata,
          nodes = EXCLUDED.nodes,
          edges = EXCLUDED.edges
      `;
      return res.status(200).json({ message: 'Workflow saved successfully' });
    }
    
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ message: 'Workflow ID is required' });
      await sql`DELETE FROM "AI_Agent".workflows WHERE id = ${id}::UUID`;
      return res.status(200).json({ message: 'Workflow deleted successfully' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Workflow API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
