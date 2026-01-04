import { sql } from './_db';
import { Agent, AgentVersionData } from '../types';

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM "AI_Agent".agents ORDER BY created_at DESC`;
      const agents = rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        role: row.role || '',
        domain: row.domain || '',
        goal: row.goal,
        backstory: row.backstory,
        taskDescription: row.task_description,
        inputs: row.inputs,
        expectedOutput: row.expected_output,
        outputFileExtension: row.output_file_extension,
        config: row.config,
        toolIds: row.tool_ids || [],
        version: row.version,
        versions: row.versions || []
      }));
      return res.status(200).json(agents);
    } 
    
    if (req.method === 'POST') {
      const agent: Agent = req.body;
      const getComparableData = (a: any): AgentVersionData => {
        const { name, description, role, domain, goal, backstory, inputs, config } = a;
        return { name, description, role, domain, goal, backstory, inputs, config, taskDescription: a.task_description || a.taskDescription, expectedOutput: a.expected_output || a.expectedOutput, outputFileExtension: a.output_file_extension || a.outputFileExtension, toolIds: a.tool_ids || a.toolIds || [], };
      };
      const existingRows = await sql`SELECT * FROM "AI_Agent".agents WHERE id = ${agent.id}::UUID`;

      if (existingRows.length > 0) {
        const oldAgent = existingRows[0];
        if (JSON.stringify(getComparableData(oldAgent)) !== JSON.stringify(getComparableData(agent))) {
          const snapshotData: AgentVersionData = getComparableData(oldAgent);
          const snapshotEntry = { version: oldAgent.version, data: snapshotData, createdAt: Date.now() };
          const newVersions = [...(oldAgent.versions || []), snapshotEntry];
          const newVersionNumber = oldAgent.version + 1;
          
          await sql`
            UPDATE "AI_Agent".agents SET
              name = ${agent.name}, description = ${agent.description}, role = ${agent.role}, domain = ${agent.domain}, goal = ${agent.goal}, backstory = ${agent.backstory},
              task_description = ${agent.taskDescription}, inputs = ${JSON.stringify(agent.inputs)}, expected_output = ${agent.expectedOutput}, output_file_extension = ${agent.outputFileExtension || null},
              config = ${JSON.stringify(agent.config)}, tool_ids = ${agent.toolIds || []},
              version = ${newVersionNumber}, versions = ${JSON.stringify(newVersions)}
            WHERE id = ${agent.id}::UUID
          `;
        } else {
           await sql`
            UPDATE "AI_Agent".agents SET version = ${agent.version}, versions = ${JSON.stringify(agent.versions)} WHERE id = ${agent.id}::UUID
          `;
        }
      } else {
        await sql`
          INSERT INTO "AI_Agent".agents (id, name, description, role, domain, goal, backstory, task_description, inputs, expected_output, output_file_extension, config, tool_ids, version, versions)
          VALUES (${agent.id}::UUID, ${agent.name}, ${agent.description}, ${agent.role}, ${agent.domain}, ${agent.goal}, ${agent.backstory}, ${agent.taskDescription}, ${JSON.stringify(agent.inputs)}, ${agent.expectedOutput}, ${agent.outputFileExtension || null}, ${JSON.stringify(agent.config)}, ${agent.toolIds || []}, 1, '[]'::jsonb)
        `;
      }
      return res.status(200).json({ message: 'Agent saved successfully' });
    }
    
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ message: 'Agent ID is required' });
      await sql`DELETE FROM "AI_Agent".agents WHERE id = ${id}::UUID`;
      return res.status(200).json({ message: 'Agent deleted successfully' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Agent API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
