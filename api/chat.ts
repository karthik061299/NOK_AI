import { sql } from './_db';
import { ChatSession, ChatMessage } from '../types';

export default async function handler(req, res) {
  const { type, sessionId, id, timestamp } = req.query;

  try {
    // ---- SESSIONS ROUTING ----
    if (type === 'sessions') {
      if (req.method === 'GET') {
        const rows = await sql`SELECT * FROM "AI_Agent".chat_sessions ORDER BY timestamp DESC`;
        return res.status(200).json(rows.map(r => ({ id: r.id, title: r.title, model: r.model, timestamp: Number(r.timestamp) })));
      }
      if (req.method === 'POST') {
        const session: ChatSession = req.body;
        await sql`
          INSERT INTO "AI_Agent".chat_sessions (id, title, model, timestamp)
          VALUES (${session.id}::UUID, ${session.title}, ${session.model}, ${session.timestamp})
          ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, model = EXCLUDED.model, timestamp = EXCLUDED.timestamp
        `;
        return res.status(200).json({ message: 'Session saved' });
      }
      if (req.method === 'DELETE') {
        if (!id) return res.status(400).json({ message: 'Session ID required' });
        await sql`DELETE FROM "AI_Agent".chat_sessions WHERE id = ${id as string}::UUID`;
        await sql`DELETE FROM "AI_Agent".chat_messages WHERE session_id = ${id as string}::UUID`;
        return res.status(200).json({ message: 'Session deleted' });
      }
    }

    // ---- MESSAGES ROUTING ----
    if (type === 'messages') {
      if (req.method === 'GET') {
        if (!sessionId) return res.status(400).json({ message: 'Session ID required' });
        const rows = await sql`SELECT * FROM "AI_Agent".chat_messages WHERE session_id = ${sessionId as string}::UUID ORDER BY timestamp ASC`;
        return res.status(200).json(rows.map(r => ({ id: r.id, session_id: r.session_id, role: r.role, content: r.content, timestamp: Number(r.timestamp) })));
      }
      if (req.method === 'POST') {
        const msg: ChatMessage = req.body;
        await sql`
          INSERT INTO "AI_Agent".chat_messages (id, session_id, role, content, timestamp)
          VALUES (${msg.id}::UUID, ${msg.session_id}::UUID, ${msg.role}, ${msg.content}, ${msg.timestamp})
        `;
        return res.status(200).json({ message: 'Message saved' });
      }
      if (req.method === 'DELETE') { // For pruning message history
        if (!sessionId || !timestamp) return res.status(400).json({ message: 'Session ID and timestamp required' });
        await sql`DELETE FROM "AI_Agent".chat_messages WHERE session_id = ${sessionId as string}::UUID AND timestamp >= ${Number(timestamp)}`;
        return res.status(200).json({ message: 'Messages pruned' });
      }
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed or invalid 'type' parameter` });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}