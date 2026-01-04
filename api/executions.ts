import { sql } from './_db';
import { ExecutionLog } from '../types';

export default async function handler(req, res) {
  const { executionId } = req.query;

  try {
    if (req.method === 'GET') {
      if (executionId) {
        // Get logs for a specific execution
        const rows = await sql`SELECT * FROM "AI_Agent".execution_logs WHERE execution_id = ${executionId as string}::UUID ORDER BY timestamp ASC`;
        const logs = rows.map(row => ({
          id: row.id, execution_id: row.execution_id, timestamp: Number(row.timestamp), agentName: row.agent_name,
          status: row.status, input: row.input, output: row.output, error: row.error, nodeId: row.node_id,
          version: row.version, toolCalls: row.tool_calls
        }));
        return res.status(200).json(logs);
      } else {
        // Get all execution histories
        const rows = await sql`
          SELECT 
            e.execution_id as id, e.workflow_id, MAX(e.duration) as duration, MAX(e.timestamp) as timestamp, 
            (w.metadata->>'name') as workflow_name,
            (SELECT status FROM "AI_Agent".execution_logs WHERE execution_id = e.execution_id ORDER BY timestamp DESC LIMIT 1) as status
          FROM "AI_Agent".execution_logs e
          JOIN "AI_Agent".workflows w ON e.workflow_id = w.id
          GROUP BY e.execution_id, e.workflow_id, w.metadata->>'name'
          ORDER BY timestamp DESC`;
        
        const executions = rows.map(row => ({
          id: row.id, workflow_id: row.workflow_id, workflow_name: row.workflow_name || 'Unknown Workflow',
          status: row.status, timestamp: Number(row.timestamp), duration: row.duration ? Number(row.duration) : undefined
        }));
        return res.status(200).json(executions);
      }
    }

    if (req.method === 'POST') {
      // Save a log entry
      const { workflowId, log, duration } = req.body as { workflowId: string; log: ExecutionLog; duration?: number };
      await sql`
        INSERT INTO "AI_Agent".execution_logs (id, workflow_id, execution_id, timestamp, agent_name, status, input, output, error, node_id, version, tool_calls, duration)
        VALUES (${log.id}::UUID, ${workflowId}::UUID, ${log.execution_id}::UUID, ${log.timestamp}, ${log.agentName}, ${log.status}, ${log.input}, ${log.output}, ${log.error}, ${log.nodeId}, ${log.version || 1}, ${JSON.stringify(log.toolCalls || [])}, ${duration || null})
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status, output = EXCLUDED.output, error = EXCLUDED.error, tool_calls = EXCLUDED.tool_calls,
          duration = COALESCE(EXCLUDED.duration, "AI_Agent".execution_logs.duration)
      `;
      return res.status(200).json({ message: 'Log saved' });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Executions API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
