import { neon } from '@neondatabase/serverless';
import { Agent, Workflow, ExecutionLog, DBModel, WorkflowExecution, Tool, ChatMessage, ChatSession, Engine, FileExtension, AgentVersionData, User, ReportedIssue, KnowledgeBase, Guardrail, SemanticCategory } from '../types';

// Connect to the remote PostgreSQL database using the provided credentials.
const connectionString = 'postgresql://neondb_owner:npg_o5YcBDbpueE8@ep-dawn-river-a1yzfjdr-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(connectionString, {
  fetchOptions: {
    keepalive: true,
  },
});
const SCHEMA = '"AI_Agent"';

const withDbRetry = async <T>(apiCall: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> => {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error: any) {
      lastError = error;
      const errorMessage = (error?.message || '').toLowerCase();
      if ((errorMessage.includes('failed to fetch') || errorMessage.includes('authentication failed')) && attempt < maxRetries - 1) {
        const delay = initialDelay * (2 ** attempt) + Math.floor(Math.random() * 200); // with jitter
        console.warn(`Database connection failed. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error("Database Error (non-retryable or final attempt):", error);
        throw error;
      }
    }
  }
  throw lastError;
};

const _initSchema = async () => {
  await sql`CREATE SCHEMA IF NOT EXISTS ${sql.unsafe(SCHEMA.replace(/"/g, ''))}`;

  await sql`
    CREATE OR REPLACE FUNCTION ${sql.unsafe(SCHEMA)}.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
    END;
    $$ language 'plpgsql';
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.domains (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.file_extensions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      extension VARCHAR(20) UNIQUE NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.ai_engines (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      api_key TEXT,
      is_active BOOLEAN DEFAULT TRUE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.models (
      id TEXT PRIMARY KEY,
      engine_id INTEGER REFERENCES ${sql.unsafe(SCHEMA)}.ai_engines(id),
      name VARCHAR(255) NOT NULL,
      full_name TEXT,
      max_tokens INTEGER,
      is_active BOOLEAN DEFAULT TRUE
    )
  `;
  
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'User'`;
  
  // @ts-ignore
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.shared_items (
      item_id UUID NOT NULL,
      item_type TEXT NOT NULL,
      user_id UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE CASCADE,
      PRIMARY KEY (item_id, user_id)
    );
  `;

  await sql`CREATE EXTENSION IF NOT EXISTS vector;`;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.knowledge_bases (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      file_names TEXT[],
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE SET NULL
    )
  `;
  await sql`DROP TRIGGER IF EXISTS update_kbs_updated_at ON ${sql.unsafe(SCHEMA)}.knowledge_bases;`;
  await sql`CREATE TRIGGER update_kbs_updated_at BEFORE UPDATE ON ${sql.unsafe(SCHEMA)}.knowledge_bases FOR EACH ROW EXECUTE FUNCTION ${sql.unsafe(SCHEMA)}.update_updated_at_column();`;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.knowledge_base_chunks (
      id UUID PRIMARY KEY,
      knowledge_base_id UUID REFERENCES ${sql.unsafe(SCHEMA)}.knowledge_bases(id) ON DELETE CASCADE,
      content TEXT,
      embedding vector(768),
      file_name TEXT
    )
  `;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.knowledge_base_chunks ALTER COLUMN embedding TYPE vector(768);`;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.tools (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      class_name TEXT NOT NULL,
      code TEXT,
      language TEXT,
      parameters JSONB,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.tools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.tools ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.tools ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE SET NULL;`;
  await sql`DROP TRIGGER IF EXISTS update_tools_updated_at ON ${sql.unsafe(SCHEMA)}.tools;`;
  await sql`CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON ${sql.unsafe(SCHEMA)}.tools FOR EACH ROW EXECUTE FUNCTION ${sql.unsafe(SCHEMA)}.update_updated_at_column();`;
  
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.guardrails (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      applies_to_input BOOLEAN DEFAULT TRUE,
      applies_to_output BOOLEAN DEFAULT TRUE,
      method TEXT NOT NULL,
      config JSONB,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE SET NULL
    )
  `;
  await sql`DROP TRIGGER IF EXISTS update_guardrails_updated_at ON ${sql.unsafe(SCHEMA)}.guardrails;`;
  await sql`CREATE TRIGGER update_guardrails_updated_at BEFORE UPDATE ON ${sql.unsafe(SCHEMA)}.guardrails FOR EACH ROW EXECUTE FUNCTION ${sql.unsafe(SCHEMA)}.update_updated_at_column();`;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.agents (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      role TEXT,
      domain TEXT,
      goal TEXT,
      backstory TEXT,
      task_description TEXT,
      inputs JSONB,
      expected_output TEXT,
      output_file_extension TEXT,
      config JSONB,
      tool_ids TEXT[],
      version INTEGER DEFAULT 1,
      versions JSONB,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.agents ADD COLUMN IF NOT EXISTS manager_condition TEXT;`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.agents ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.agents ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.agents ADD COLUMN IF NOT EXISTS knowledge_base_ids UUID[];`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.agents ADD COLUMN IF NOT EXISTS guardrail_ids UUID[];`;
  await sql`DROP TRIGGER IF EXISTS update_agents_updated_at ON ${sql.unsafe(SCHEMA)}.agents;`;
  await sql`CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON ${sql.unsafe(SCHEMA)}.agents FOR EACH ROW EXECUTE FUNCTION ${sql.unsafe(SCHEMA)}.update_updated_at_column();`;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.workflows (
      id UUID PRIMARY KEY,
      metadata JSONB,
      nodes JSONB,
      edges JSONB,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.workflows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.workflows ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE SET NULL;`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.workflows ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE SET NULL;`;
  await sql`DROP TRIGGER IF EXISTS update_workflows_updated_at ON ${sql.unsafe(SCHEMA)}.workflows;`;
  await sql`CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON ${sql.unsafe(SCHEMA)}.workflows FOR EACH ROW EXECUTE FUNCTION ${sql.unsafe(SCHEMA)}.update_updated_at_column();`;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.execution_logs (
      id UUID PRIMARY KEY,
      workflow_id UUID REFERENCES ${sql.unsafe(SCHEMA)}.workflows(id) ON DELETE CASCADE,
      execution_id UUID NOT NULL,
      timestamp BIGINT NOT NULL,
      agent_name TEXT,
      status TEXT,
      input TEXT,
      output TEXT,
      error TEXT,
      node_id TEXT,
      version INTEGER,
      tool_calls JSONB,
      duration BIGINT
    )
  `;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.execution_logs ADD COLUMN IF NOT EXISTS knowledge_base_info JSONB;`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.execution_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE SET NULL;`;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.chat_sessions (
      id UUID PRIMARY KEY,
      title TEXT,
      model TEXT,
      timestamp BIGINT
    )
  `;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.chat_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES ${sql.unsafe(SCHEMA)}.users(id) ON DELETE CASCADE;`;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.chat_messages (
      id UUID PRIMARY KEY,
      session_id UUID REFERENCES ${sql.unsafe(SCHEMA)}.chat_sessions(id) ON DELETE CASCADE,
      role TEXT,
      content TEXT,
      timestamp BIGINT
    )
  `;
  
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.reported_issues (
      id UUID PRIMARY KEY,
      description TEXT NOT NULL,
      raised_by_email TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'Pending'
    )
  `;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.reported_issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.reported_issues ADD COLUMN IF NOT EXISTS updated_by_email TEXT;`;
  await sql`UPDATE ${sql.unsafe(SCHEMA)}.reported_issues SET status = 'Pending' WHERE status = 'Open';`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.reported_issues ALTER COLUMN status SET DEFAULT 'Pending';`;
  
  await sql`DROP TABLE IF EXISTS ${sql.unsafe(SCHEMA)}.issue_notification_recipients;`;


  // Seed initial data
  await sql`
    INSERT INTO ${sql.unsafe(SCHEMA)}.domains (name) VALUES
    ('Software Development'), ('Data Analysis'), ('Creative Writing'), ('Business'), ('General')
    ON CONFLICT (name) DO NOTHING;
  `;

  await sql`
    INSERT INTO ${sql.unsafe(SCHEMA)}.file_extensions (name, extension) VALUES
    ('Plain Text', '.txt'), ('Markdown', '.md'), ('Python', '.py'), ('JavaScript', '.js'), ('JSON', '.json'), ('CSV', '.csv'), ('HTML', '.html')
    ON CONFLICT (extension) DO NOTHING;
  `;

  await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.models WHERE engine_id = (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'Hugging Face')`;
  await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'Hugging Face'`;

  await sql`
    INSERT INTO ${sql.unsafe(SCHEMA)}.ai_engines (name, description, is_active, api_key) VALUES
    ('GoogleAI', 'Google Gemini Family Models', TRUE, 'AIzaSyDoFuV3MCwWi4pgLhn5TjU5o0ueiGz4ay4'),
    ('OpenAI', 'OpenAI GPT Models', FALSE, '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'),
    ('Anthropic', 'Anthropic Claude Models', FALSE, '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'),
    ('Meta', 'Meta Llama Models via Groq', TRUE, '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')
    ON CONFLICT (name) DO UPDATE SET 
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active,
      api_key = COALESCE(${sql.unsafe(SCHEMA)}.ai_engines.api_key, EXCLUDED.api_key);
  `;
  
  await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.models WHERE id IN ('gemini-1.5-pro', 'gemini-1.5-flash')`;
  
  await sql`
    INSERT INTO ${sql.unsafe(SCHEMA)}.models (id, engine_id, name, full_name, max_tokens, is_active)
    SELECT * FROM (
      VALUES
        ('gemini-3-pro-preview', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'GoogleAI'), 'Gemini 3 Pro Preview', 'gemini-3-pro-preview', 1048576, TRUE),
        ('gemini-3-flash-preview', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'GoogleAI'), 'Gemini 3 Flash Preview', 'gemini-3-flash-preview', 1048576, TRUE),
        ('text-embedding-004', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'GoogleAI'), 'Embedding 004', 'text-embedding-004', 0, TRUE)
    ) AS v(id, engine_id, name, full_name, max_tokens, is_active)
    WHERE v.engine_id IS NOT NULL
    ON CONFLICT (id) DO UPDATE SET
      engine_id = EXCLUDED.engine_id, name = EXCLUDED.name, full_name = EXCLUDED.full_name, max_tokens = EXCLUDED.max_tokens, is_active = EXCLUDED.is_active;
  `;

  await sql`
    INSERT INTO ${sql.unsafe(SCHEMA)}.models (id, engine_id, name, full_name, max_tokens, is_active)
    SELECT * FROM (
      VALUES
        ('gpt-4o', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'OpenAI'), 'GPT-4o', 'gpt-4o', 128000, TRUE),
        ('gpt-4.1', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'OpenAI'), 'GPT-4.1', 'gpt-4.1', 128000, TRUE),
        ('gpt-4o-mini', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'OpenAI'), 'GPT-4o mini', 'gpt-4o-mini', 128000, TRUE)
    ) AS v(id, engine_id, name, full_name, max_tokens, is_active)
    WHERE v.engine_id IS NOT NULL
    ON CONFLICT (id) DO UPDATE SET
      engine_id = EXCLUDED.engine_id, name = EXCLUDED.name, full_name = EXCLUDED.full_name, max_tokens = EXCLUDED.max_tokens, is_active = EXCLUDED.is_active;
  `;

  await sql`
    INSERT INTO ${sql.unsafe(SCHEMA)}.models (id, engine_id, name, full_name, max_tokens, is_active)
    SELECT * FROM (
      VALUES
        ('claude-3-haiku-20240307', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'Anthropic'), 'Claude 3 Haiku', 'claude-3-haiku-20240307', 200000, TRUE),
        ('claude-3-5-sonnet-20240620', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'Anthropic'), 'Claude 3.5 Sonnet', 'claude-3-5-sonnet-20240620', 200000, TRUE)
    ) AS v(id, engine_id, name, full_name, max_tokens, is_active)
    WHERE v.engine_id IS NOT NULL
    ON CONFLICT (id) DO UPDATE SET
      engine_id = EXCLUDED.engine_id, name = EXCLUDED.name, full_name = EXCLUDED.full_name, max_tokens = EXCLUDED.max_tokens, is_active = EXCLUDED.is_active;
  `;
  
  await sql`
    INSERT INTO ${sql.unsafe(SCHEMA)}.models (id, engine_id, name, full_name, max_tokens, is_active)
    SELECT * FROM (
      VALUES
        ('meta-llama/llama-4-scout-17b-16e-instruct', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'Meta'), 'Llama 4 Scout', 'meta-llama/llama-4-scout-17b-16e-instruct', 8192, TRUE),
        ('meta-llama/llama-4-maverick-17b-128e-instruct', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'Meta'), 'Llama 4 Maverick', 'meta-llama/llama-4-maverick-17b-128e-instruct', 8192, TRUE),
        ('llama-3.3-70b-versatile', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'Meta'), 'Llama 3.3 70B', 'llama-3.3-70b-versatile', 8192, TRUE),
        ('llama-3.1-8b-instant', (SELECT id FROM ${sql.unsafe(SCHEMA)}.ai_engines WHERE name = 'Meta'), 'Llama 3.1 8B', 'llama-3.1-8b-instant', 8192, TRUE)
    ) AS v(id, engine_id, name, full_name, max_tokens, is_active)
    WHERE v.engine_id IS NOT NULL
    ON CONFLICT (id) DO UPDATE SET
      engine_id = EXCLUDED.engine_id, name = EXCLUDED.name, full_name = EXCLUDED.full_name, max_tokens = EXCLUDED.max_tokens, is_active = EXCLUDED.is_active;
  `;

  await sql`
    INSERT INTO ${sql.unsafe(SCHEMA)}.guardrails (id, name, description, applies_to_input, applies_to_output, method, config, is_default)
    VALUES (
      'a1b2c3d4-e5f6-7890-1234-567890abcdef', -- fixed UUID for idempotency
      'PII Keywords',
      'Blocks common personally identifiable information keywords like SSN. This is a default guardrail applied to all agents.',
      TRUE,
      TRUE,
      'keyword_filter',
      '{"keywords": [{"value":"ssn", "action":"block"}, {"value":"social security", "action":"block"}, {"value":"national id", "action":"block"}, {"value":"passport number", "action":"block"}]}',
      TRUE
    ) ON CONFLICT (id) DO UPDATE SET config = '{"keywords": [{"value":"ssn", "action":"block"}, {"value":"social security", "action":"block"}, {"value":"national id", "action":"block"}, {"value":"passport number", "action":"block"}]}'::jsonb;
  `;

  await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.guardrails WHERE id = 'b2c3d4e5-f6a7-8901-2345-67890abcdef1';`;
};

const mapAgentFromRow = (row: any): Agent => ({
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
  managerCondition: row.manager_condition,
  config: row.config,
  toolIds: row.tool_ids || [],
  knowledgeBaseIds: row.knowledge_base_ids || [],
  guardrailIds: row.guardrail_ids || [],
  version: row.version,
  versions: row.versions || [],
  created_at: new Date(row.created_at).getTime(),
  updated_at: row.updated_at ? new Date(row.updated_at).getTime() : new Date(row.created_at).getTime(),
  created_by: row.created_by,
  updated_by: row.updated_by,
  created_by_email: row.created_by_email,
  updated_by_email: row.updated_by_email
});

export const dbService = {
  initSchema: () => withDbRetry(_initSchema),
  
  // Lookups
  getDomains: (): Promise<string[]> => withDbRetry(async () => {
    const res = await sql`SELECT name FROM ${sql.unsafe(SCHEMA)}.domains ORDER BY name ASC`;
    return res.map(r => r.name as string);
  }),
  getFileExtensions: (): Promise<FileExtension[]> => withDbRetry(async () => {
    const res = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.file_extensions ORDER BY name ASC`;
    return res.map(r => ({ id: r.id as number, name: r.name as string, extension: r.extension as string }));
  }),
  getEngines: (): Promise<Omit<Engine, 'api_key'>[]> => withDbRetry(async () => {
    const res = await sql`SELECT id, name, description, is_active FROM ${sql.unsafe(SCHEMA)}.ai_engines ORDER BY id ASC`;
    return res.map(r => ({
      id: r.id as number,
      name: r.name as string,
      description: r.description as string,
      is_active: r.is_active as boolean,
    }));
  }),
  getEnginesWithKeys: (): Promise<Engine[]> => withDbRetry(async () => {
    const res = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.ai_engines ORDER BY id ASC`;
    return res.map(r => ({
      id: r.id as number,
      name: r.name as string,
      description: r.description as string,
      api_key: r.api_key as string,
      is_active: r.is_active as boolean,
    }));
  }),
  updateEngine: (engine: Engine): Promise<void> => withDbRetry(async () => {
    await sql`UPDATE ${sql.unsafe(SCHEMA)}.ai_engines SET api_key = ${engine.api_key} WHERE id = ${engine.id}`;
  }),
  getModels: (): Promise<DBModel[]> => withDbRetry(async () => {
    const res = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.models ORDER BY engine_id, name ASC`;
    return res.map(r => ({
      id: r.id as string,
      engine_id: Number(r.engine_id),
      name: r.name as string,
      full_name: r.full_name as string,
      max_tokens: Number(r.max_tokens),
      is_active: r.is_active as boolean
    }));
  }),
  
  // Agents
  getAgents: (user?: User): Promise<Agent[]> => withDbRetry(async () => {
    const rows = await sql`
      SELECT a.*, creator.email as created_by_email, updater.email as updated_by_email
      FROM ${sql.unsafe(SCHEMA)}.agents a
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users creator ON a.created_by = creator.id
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users updater ON a.updated_by = updater.id
      ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
    `;
    return rows.map(mapAgentFromRow);
  }),
  getAgentByName: (name: string): Promise<Agent | null> => withDbRetry(async () => {
    const rows = await sql`
      SELECT a.*, creator.email as created_by_email, updater.email as updated_by_email
      FROM ${sql.unsafe(SCHEMA)}.agents a
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users creator ON a.created_by = creator.id
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users updater ON a.updated_by = updater.id
      WHERE a.name = ${name} LIMIT 1`;
    if (rows.length === 0) return null;
    return mapAgentFromRow(rows[0]);
  }),
  saveAgent: (agent: Agent, userId: string): Promise<void> => withDbRetry(async () => {
    const getComparableData = (a: any): AgentVersionData => {
        const { name, description, role, domain, goal, backstory, inputs, config } = a;
        return { name, description, role, domain, goal, backstory, inputs, config, taskDescription: a.task_description || a.taskDescription, expectedOutput: a.expected_output || a.expectedOutput, outputFileExtension: a.output_file_extension || a.outputFileExtension, toolIds: a.tool_ids || a.toolIds || [], managerCondition: a.manager_condition || a.managerCondition, knowledgeBaseIds: a.knowledge_base_ids || a.knowledgeBaseIds || [], guardrailIds: a.guardrail_ids || a.guardrailIds || [] };
    };

    const existingRows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.agents WHERE id = ${agent.id}`;
    if (existingRows.length > 0) {
        const oldAgent = mapAgentFromRow(existingRows[0]);
        if (JSON.stringify(getComparableData(oldAgent)) !== JSON.stringify(getComparableData(agent))) {
          const snapshotData: AgentVersionData = getComparableData(oldAgent);
          const versionCreatorId = oldAgent.updated_by || oldAgent.created_by;
          const snapshotEntry = { ...oldAgent.versions?.find(v => v.version === oldAgent.version), version: oldAgent.version, data: snapshotData, createdAt: oldAgent.updated_at || oldAgent.created_at || Date.now(), created_by: versionCreatorId };
          const newVersions = [...(oldAgent.versions || []).filter(v => v.version !== oldAgent.version), snapshotEntry];
          const newVersionNumber = oldAgent.version + 1;
          
          const sanitizedToolIds = (agent.toolIds || []).filter(id => id);
          const sanitizedKbIds = (agent.knowledgeBaseIds || []).filter(id => id);
          const sanitizedGuardrailIds = (agent.guardrailIds || []).filter(id => id);

          await sql`
            UPDATE ${sql.unsafe(SCHEMA)}.agents SET
              name = ${agent.name}, description = ${agent.description}, role = ${agent.role}, domain = ${agent.domain}, goal = ${agent.goal}, backstory = ${agent.backstory},
              task_description = ${agent.taskDescription}, inputs = ${JSON.stringify(agent.inputs)}, expected_output = ${agent.expectedOutput}, output_file_extension = ${agent.outputFileExtension || null},
              config = ${JSON.stringify(agent.config)}, tool_ids = ${sanitizedToolIds}, knowledge_base_ids = ${sanitizedKbIds}, guardrail_ids = ${sanitizedGuardrailIds}, manager_condition = ${agent.managerCondition || null},
              version = ${newVersionNumber}, versions = ${JSON.stringify(newVersions)}, updated_by = ${userId}
            WHERE id = ${agent.id}
          `;
        } else if (JSON.stringify(oldAgent.versions) !== JSON.stringify(agent.versions)) {
           await sql`UPDATE ${sql.unsafe(SCHEMA)}.agents SET versions = ${JSON.stringify(agent.versions)}, updated_by = ${userId} WHERE id = ${agent.id}`;
        } else {
            // No significant changes, just touch the updated_at timestamp
            await sql`UPDATE ${sql.unsafe(SCHEMA)}.agents SET updated_by = ${userId} WHERE id = ${agent.id}`;
        }
    } else {
        const sanitizedToolIds = (agent.toolIds || []).filter(id => id);
        const sanitizedKbIds = (agent.knowledgeBaseIds || []).filter(id => id);
        const sanitizedGuardrailIds = (agent.guardrailIds || []).filter(id => id);

        await sql`
          INSERT INTO ${sql.unsafe(SCHEMA)}.agents (id, name, description, role, domain, goal, backstory, task_description, inputs, expected_output, output_file_extension, config, tool_ids, knowledge_base_ids, guardrail_ids, version, versions, manager_condition, created_by, updated_by)
          VALUES (${agent.id}, ${agent.name}, ${agent.description}, ${agent.role}, ${agent.domain}, ${agent.goal}, ${agent.backstory}, ${agent.taskDescription}, ${JSON.stringify(agent.inputs)}, ${agent.expectedOutput}, ${agent.outputFileExtension || null}, ${JSON.stringify(agent.config)}, ${sanitizedToolIds}, ${sanitizedKbIds}, ${sanitizedGuardrailIds}, 1, '[]'::jsonb, ${agent.managerCondition || null}, ${userId}, ${userId})
        `;
    }
  }),
  deleteAgent: (id: string): Promise<void> => withDbRetry(async () => {
    await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.agents WHERE id = ${id}`;
  }),
  
  // Tools
  getTools: (user?: User): Promise<Tool[]> => withDbRetry(async () => {
    const rows = await sql`
      SELECT t.*, creator.email as created_by_email, updater.email as updated_by_email
      FROM ${sql.unsafe(SCHEMA)}.tools t
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users creator ON t.created_by = creator.id
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users updater ON t.updated_by = updater.id
      ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC
    `;
    return rows.map(r => ({ id: r.id as string, name: r.name as string, description: r.description as string, className: r.class_name as string, code: r.code as string, language: r.language as any, parameters: r.parameters as any, created_at: new Date(r.created_at).getTime(), updated_at: r.updated_at ? new Date(r.updated_at).getTime() : new Date(r.created_at).getTime(), created_by: r.created_by, updated_by: r.updated_by, created_by_email: r.created_by_email, updated_by_email: r.updated_by_email }));
  }),
  saveTool: (tool: Tool, userId: string): Promise<void> => withDbRetry(async () => {
    await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.tools (id, name, description, class_name, code, parameters, language, created_at, updated_at, created_by)
      VALUES (${tool.id}, ${tool.name}, ${tool.description}, ${tool.className}, ${tool.code}, ${JSON.stringify(tool.parameters)}, ${tool.language}, to_timestamp(${ (tool.created_at || Date.now()) / 1000}), to_timestamp(${ (tool.updated_at || Date.now()) / 1000}), ${userId})
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name, 
        description = EXCLUDED.description, 
        class_name = EXCLUDED.class_name, 
        code = EXCLUDED.code, 
        parameters = EXCLUDED.parameters, 
        language = EXCLUDED.language,
        updated_at = NOW(),
        updated_by = ${userId}
    `;
  }),
  deleteTool: (id: string): Promise<void> => withDbRetry(async () => {
    await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.tools WHERE id = ${id}`;
  }),

  // Workflows
  getWorkflows: (user?: User): Promise<Workflow[]> => withDbRetry(async () => {
    const rows = await sql`
      SELECT w.*, creator.email as created_by_email, updater.email as updated_by_email
      FROM ${sql.unsafe(SCHEMA)}.workflows w
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users creator ON w.created_by = creator.id
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users updater ON w.updated_by = updater.id
      ORDER BY w.updated_at DESC NULLS LAST, w.created_at DESC
    `;
    return rows.map(r => ({ 
      metadata: r.metadata as any, 
      nodes: (r.nodes as any[] || []).map(n => ({...n, type: n.type || 'agent'})),
      edges: (r.edges as any[] || []).map(e => {
        const { humanCheckpoint, ...rest } = e;
        return rest;
      }),
      created_at: new Date(r.created_at).getTime(),
      updated_at: r.updated_at ? new Date(r.updated_at).getTime() : new Date(r.created_at).getTime(),
      created_by: r.created_by,
      updated_by: r.updated_by,
      created_by_email: r.created_by_email,
      updated_by_email: r.updated_by_email
    }));
  }),
  saveWorkflow: (workflow: Workflow, userId: string): Promise<void> => withDbRetry(async () => {
    await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.workflows (id, metadata, nodes, edges, created_at, updated_at, created_by)
      VALUES (${workflow.metadata.id}, ${JSON.stringify(workflow.metadata)}, ${JSON.stringify(workflow.nodes)}, ${JSON.stringify(workflow.edges)}, to_timestamp(${ (workflow.created_at || Date.now()) / 1000}), to_timestamp(${ (workflow.updated_at || Date.now()) / 1000}), ${userId})
      ON CONFLICT (id) DO UPDATE SET 
        metadata = EXCLUDED.metadata, 
        nodes = EXCLUDED.nodes, 
        edges = EXCLUDED.edges,
        updated_at = NOW(),
        updated_by = ${userId}
    `;
  }),
  deleteWorkflow: (id: string): Promise<void> => withDbRetry(async () => {
    await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.workflows WHERE id = ${id}`;
  }),

  // Executions
  getWorkflowExecutions: (): Promise<WorkflowExecution[]> => withDbRetry(async () => {
    const rows = await sql`
      SELECT 
        e.execution_id as id, e.workflow_id, MAX(e.duration) as duration, MAX(e.timestamp) as timestamp, 
        (w.metadata->>'name') as workflow_name,
        (SELECT status FROM ${sql.unsafe(SCHEMA)}.execution_logs WHERE execution_id = e.execution_id ORDER BY timestamp DESC LIMIT 1) as status,
        (SELECT u.email FROM ${sql.unsafe(SCHEMA)}.users u JOIN ${sql.unsafe(SCHEMA)}.execution_logs l ON u.id = l.user_id WHERE l.execution_id = e.execution_id LIMIT 1) as user_email
      FROM ${sql.unsafe(SCHEMA)}.execution_logs e 
      JOIN ${sql.unsafe(SCHEMA)}.workflows w ON e.workflow_id = w.id
      GROUP BY e.execution_id, e.workflow_id, w.metadata->>'name' 
      ORDER BY timestamp DESC
    `;
    return rows.map(r => ({
      id: r.id as string, workflow_id: r.workflow_id as string, workflow_name: (r.workflow_name as string) || 'Unknown Workflow',
      status: r.status as any, timestamp: Number(r.timestamp), duration: r.duration ? Number(r.duration) : undefined,
      user_email: r.user_email as string | undefined
    }));
  }),
  getLogsByExecution: (executionId: string): Promise<ExecutionLog[]> => withDbRetry(async () => {
    const rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.execution_logs WHERE execution_id = ${executionId} ORDER BY timestamp ASC`;
    return rows.map(r => ({
      id: r.id as string, execution_id: r.execution_id as string, timestamp: Number(r.timestamp), agentName: r.agent_name as string,
      status: r.status as any, input: r.input as string, output: r.output as string, error: r.error as string, nodeId: r.node_id as string,
      version: r.version as number, toolCalls: r.tool_calls as any[], workflowId: r.workflow_id as string, duration: r.duration ? Number(r.duration) : undefined,
      knowledgeBaseInfo: r.knowledge_base_info as any
    }));
  }),
  saveLog: (workflowId: string, log: ExecutionLog, duration?: number): Promise<void> => withDbRetry(async () => {
    await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.execution_logs (id, workflow_id, execution_id, timestamp, agent_name, status, input, output, error, node_id, version, tool_calls, duration, knowledge_base_info, user_id)
      VALUES (${log.id}, ${workflowId}, ${log.execution_id}, ${log.timestamp}, ${log.agentName}, ${log.status}, ${log.input}, ${log.output}, ${log.error}, ${log.nodeId}, ${log.version || null}, ${JSON.stringify(log.toolCalls || [])}, ${duration || null}, ${log.knowledgeBaseInfo ? JSON.stringify(log.knowledgeBaseInfo) : null}, ${log.user_id || null})
      ON CONFLICT (id) DO UPDATE SET 
        status = EXCLUDED.status, 
        output = EXCLUDED.output, 
        error = EXCLUDED.error, 
        tool_calls = EXCLUDED.tool_calls, 
        duration = COALESCE(EXCLUDED.duration, ${sql.unsafe(SCHEMA)}.execution_logs.duration),
        knowledge_base_info = EXCLUDED.knowledge_base_info
    `;
  }),

  // Users
  getAllUsers: (): Promise<User[]> => withDbRetry(async () => {
    const rows = await sql`SELECT id, email, role FROM ${sql.unsafe(SCHEMA)}.users ORDER BY email ASC`;
    return rows.map(r => ({
      id: r.id as string,
      email: r.email as string,
      role: r.role as 'Admin' | 'User' | 'Owner'
    }));
  }),
  updateUserRole: (userId: string, role: 'Admin' | 'User' | 'Owner'): Promise<void> => withDbRetry(async () => {
    await sql`UPDATE ${sql.unsafe(SCHEMA)}.users SET role = ${role} WHERE id = ${userId}`;
  }),
  getUserByEmail: (email: string): Promise<(User & { password_hash: string }) | null> => withDbRetry(async () => {
    const rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.users WHERE email = ${email} LIMIT 1`;
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id as string,
      email: row.email as string,
      password_hash: row.password_hash as string,
      role: row.role as 'Admin' | 'User' | 'Owner',
    };
  }),
  createUser: (id: string, email: string, passwordHash: string, role: 'Owner' | 'User'): Promise<void> => withDbRetry(async () => {
    await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.users (id, email, password_hash, role)
      VALUES (${id}, ${email}, ${passwordHash}, ${role})
    `;
  }),
  updateUserPassword: (userId: string, newPasswordHash: string): Promise<void> => withDbRetry(async () => {
    await sql`
      UPDATE ${sql.unsafe(SCHEMA)}.users SET password_hash = ${newPasswordHash} WHERE id = ${userId}
    `;
  }),

  // Chat
  getChatSessions: (userId: string): Promise<ChatSession[]> => withDbRetry(async () => {
    const rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.chat_sessions WHERE user_id = ${userId} ORDER BY timestamp DESC`;
    return rows.map(r => ({ id: r.id as string, title: r.title as string, model: r.model as string, timestamp: Number(r.timestamp), user_id: r.user_id as string }));
  }),
  saveChatSession: (session: ChatSession): Promise<void> => withDbRetry(async () => {
    await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.chat_sessions (id, title, model, timestamp, user_id) VALUES (${session.id}, ${session.title}, ${session.model}, ${session.timestamp}, ${session.user_id})
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, model = EXCLUDED.model, timestamp = EXCLUDED.timestamp
    `;
  }),
  deleteChatSession: (id: string): Promise<void> => withDbRetry(async () => {
    await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.chat_messages WHERE session_id = ${id}`;
    await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.chat_sessions WHERE id = ${id}`;
  }),
  getChatMessagesBySession: (sessionId: string): Promise<ChatMessage[]> => withDbRetry(async () => {
    const rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.chat_messages WHERE session_id = ${sessionId} ORDER BY timestamp ASC`;
    return rows.map(r => ({ id: r.id as string, session_id: r.session_id as string, role: r.role as any, content: r.content as string, timestamp: Number(r.timestamp) }));
  }),
  saveChatMessage: (msg: ChatMessage): Promise<void> => withDbRetry(async () => {
    await sql`INSERT INTO ${sql.unsafe(SCHEMA)}.chat_messages (id, session_id, role, content, timestamp) VALUES (${msg.id}, ${msg.session_id}, ${msg.role}, ${msg.content}, ${msg.timestamp})`;
  }),
  deleteMessagesAfter: (sessionId: string, timestamp: number): Promise<void> => withDbRetry(async () => {
    await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.chat_messages WHERE session_id = ${sessionId} AND timestamp >= ${timestamp}`;
  }),

  // Issues
  getReportedIssues: (user: User): Promise<ReportedIssue[]> => withDbRetry(async () => {
    let rows;
    if (user.role === 'Admin' || user.role === 'Owner') {
      rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.reported_issues ORDER BY created_at DESC`;
    } else {
      rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.reported_issues WHERE raised_by_email = ${user.email} ORDER BY created_at DESC`;
    }
    return rows.map(r => ({
      id: r.id as string,
      description: r.description as string,
      raised_by_email: r.raised_by_email as string,
      created_at: new Date(r.created_at as string).getTime(),
      status: r.status as 'Pending' | 'Resolved' | 'Revoked',
      updated_at: r.updated_at ? new Date(r.updated_at as string).getTime() : undefined,
      updated_by_email: r.updated_by_email as string | undefined
    }));
  }),
  reportIssue: (description: string, email: string): Promise<void> => withDbRetry(async () => {
    await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.reported_issues (id, description, raised_by_email, status)
      VALUES (${crypto.randomUUID()}, ${description}, ${email}, 'Pending')
    `;
  }),
  updateIssueStatus: (issueId: string, newStatus: ReportedIssue['status'], updater: User): Promise<void> => withDbRetry(async () => {
    const [issue] = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.reported_issues WHERE id = ${issueId}`;
    if (!issue) throw new Error('Issue not found.');

    let canUpdate = false;
    if ((updater.role === 'Admin' || updater.role === 'Owner') && (newStatus === 'Pending' || newStatus === 'Resolved')) {
      canUpdate = true;
    }
    if (updater.role === 'User' && newStatus === 'Revoked' && issue.raised_by_email === updater.email && issue.status === 'Pending') {
      canUpdate = true;
    }
    if (!canUpdate) throw new Error('Permission denied.');
    
    await sql`
      UPDATE ${sql.unsafe(SCHEMA)}.reported_issues 
      SET status = ${newStatus}, updated_at = NOW(), updated_by_email = ${updater.email} 
      WHERE id = ${issueId}
    `;
  }),
  
  // Knowledge Bases
  getKnowledgeBases: (user?: User): Promise<KnowledgeBase[]> => withDbRetry(async () => {
    const rows = await sql`
      SELECT kb.*, creator.email as created_by_email, updater.email as updated_by_email
      FROM ${sql.unsafe(SCHEMA)}.knowledge_bases kb
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users creator ON kb.created_by = creator.id
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users updater ON kb.updated_by = updater.id
      ORDER BY kb.updated_at DESC NULLS LAST, kb.created_at DESC
    `;
    return rows.map(r => ({ 
        id: r.id as string, 
        name: r.name as string, 
        description: r.description as string, 
        file_names: r.file_names as string[], 
        created_at: new Date(r.created_at).getTime(), 
        updated_at: r.updated_at ? new Date(r.updated_at).getTime() : new Date(r.created_at).getTime(),
        created_by: r.created_by,
        updated_by: r.updated_by,
        created_by_email: r.created_by_email,
        updated_by_email: r.updated_by_email
    }));
  }),
  saveKnowledgeBase: (kb: KnowledgeBase, userId: string): Promise<void> => withDbRetry(async () => {
      await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.knowledge_bases (id, name, description, file_names, created_at, updated_at, created_by, updated_by)
      VALUES (${kb.id}, ${kb.name}, ${kb.description}, ${kb.file_names}, to_timestamp(${ (kb.created_at || Date.now()) / 1000}), to_timestamp(${ (kb.updated_at || Date.now()) / 1000}), ${userId}, ${userId})
      ON CONFLICT (id) DO UPDATE SET 
          name = EXCLUDED.name, 
          description = EXCLUDED.description, 
          file_names = EXCLUDED.file_names,
          updated_at = NOW(),
          updated_by = ${userId}
      `;
  }),
  deleteKnowledgeBase: (id: string): Promise<void> => withDbRetry(async () => {
      await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.knowledge_base_chunks WHERE knowledge_base_id = ${id}`;
      await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.knowledge_bases WHERE id = ${id}`;
  }),
  saveKnowledgeBaseChunks: (kbId: string, chunks: { content: string; embedding: number[]; file_name: string }[]): Promise<void> => withDbRetry(async () => {
      await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.knowledge_base_chunks WHERE knowledge_base_id = ${kbId}`;
      for (const chunk of chunks) {
        await sql`
            INSERT INTO ${sql.unsafe(SCHEMA)}.knowledge_base_chunks (id, knowledge_base_id, content, embedding, file_name)
            VALUES (${crypto.randomUUID()}, ${kbId}, ${chunk.content}, ${JSON.stringify(chunk.embedding)}, ${chunk.file_name})
        `;
      }
  }),
  searchKnowledgeBaseChunks: (kbIds: string[], queryVector: number[], limit: number): Promise<{ content: string, file_name: string }[]> => withDbRetry(async () => {
      const rows = await sql`
        SELECT content, file_name FROM ${sql.unsafe(SCHEMA)}.knowledge_base_chunks
        WHERE knowledge_base_id = ANY(${kbIds})
        ORDER BY embedding <=> ${JSON.stringify(queryVector)}
        LIMIT ${limit}
      `;
      return rows as { content: string, file_name: string }[];
  }),

  // Guardrails
  getGuardrails: (user?: User): Promise<Guardrail[]> => withDbRetry(async () => {
    const rows = await sql`
      SELECT g.*, creator.email as created_by_email, updater.email as updated_by_email
      FROM ${sql.unsafe(SCHEMA)}.guardrails g
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users creator ON g.created_by = creator.id
      LEFT JOIN ${sql.unsafe(SCHEMA)}.users updater ON g.updated_by = updater.id
      ORDER BY g.updated_at DESC NULLS LAST, g.created_at DESC
    `;
    return rows.map(r => {
      // Ensure config is always an object, parsing if it's a string
      const config = (typeof r.config === 'string' && r.config ? JSON.parse(r.config) : r.config) || {};
      return {
        id: r.id as string, 
        name: r.name as string, 
        description: r.description as string, 
        appliesToInput: r.applies_to_input as boolean,
        appliesToOutput: r.applies_to_output as boolean,
        method: r.method as any,
        config: config,
        isDefault: r.is_default as boolean,
        created_at: new Date(r.created_at).getTime(), 
        updated_at: r.updated_at ? new Date(r.updated_at).getTime() : new Date(r.created_at).getTime(),
        created_by: r.created_by,
        updated_by: r.updated_by,
        created_by_email: r.created_by_email,
        updated_by_email: r.updated_by_email
      };
    });
  }),
  saveGuardrail: (guardrail: Guardrail, userId: string): Promise<void> => withDbRetry(async () => {
      await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.guardrails (id, name, description, applies_to_input, applies_to_output, method, config, is_default, created_at, updated_at, created_by, updated_by)
      VALUES (${guardrail.id}, ${guardrail.name}, ${guardrail.description}, ${guardrail.appliesToInput}, ${guardrail.appliesToOutput}, ${guardrail.method}, ${JSON.stringify(guardrail.config)}, ${guardrail.isDefault}, to_timestamp(${ (guardrail.created_at || Date.now()) / 1000}), to_timestamp(${ (guardrail.updated_at || Date.now()) / 1000}), ${userId}, ${userId})
      ON CONFLICT (id) DO UPDATE SET 
          name = EXCLUDED.name, 
          description = EXCLUDED.description, 
          applies_to_input = EXCLUDED.applies_to_input,
          applies_to_output = EXCLUDED.applies_to_output,
          method = EXCLUDED.method,
          config = EXCLUDED.config,
          is_default = EXCLUDED.is_default,
          updated_at = NOW(),
          updated_by = ${userId}
      `;
  }),
  deleteGuardrail: (id: string): Promise<void> => withDbRetry(async () => {
    await sql`UPDATE ${sql.unsafe(SCHEMA)}.agents SET guardrail_ids = array_remove(guardrail_ids, ${id}) WHERE ${id} = ANY(guardrail_ids)`;
    await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.guardrails WHERE id = ${id}`;
  }),

  // Sharing
  getSharedUsersForItem: (itemId: string): Promise<User[]> => withDbRetry(async () => {
    const rows = await sql`
      SELECT u.id, u.email, u.role
      FROM ${sql.unsafe(SCHEMA)}.users u
      JOIN ${sql.unsafe(SCHEMA)}.shared_items s ON u.id = s.user_id
      WHERE s.item_id = ${itemId}
    `;
    return rows.map(r => ({
      id: r.id as string,
      email: r.email as string,
      role: r.role as 'Admin' | 'User' | 'Owner',
    }));
  }),

  getSharedItemIdsForUser: (userId: string): Promise<Record<string, string[]>> => withDbRetry(async () => {
    const rows = await sql`SELECT item_id, item_type FROM ${sql.unsafe(SCHEMA)}.shared_items WHERE user_id = ${userId}`;
    const result: Record<string, string[]> = { agent: [], workflow: [], tool: [], knowledgeBase: [], guardrail: [] };
    for (const row of rows) {
      if (result[row.item_type as string]) {
        result[row.item_type as string].push(row.item_id as string);
      }
    }
    return result;
  }),
  
  grantAccessToItems: (items: { itemId: string; itemType: string }[], userIds: string[]): Promise<void> => withDbRetry(async () => {
    if (userIds.length === 0 || items.length === 0) return;
    const queries: any[] = [];
    for (const item of items) {
      for (const userId of userIds) {
        queries.push(
          sql`
            INSERT INTO ${sql.unsafe(SCHEMA)}.shared_items (item_id, item_type, user_id) 
            VALUES (${item.itemId}, ${item.itemType}, ${userId}) 
            ON CONFLICT (item_id, user_id) DO NOTHING
          `
        );
      }
    }
    // @ts-ignore
    await sql.transaction(queries);
  }),

  shareItemWithUsers: (itemId: string, itemType: string, userIds: string[]): Promise<void> => withDbRetry(async () => {
    const queries: any[] = [
      sql`
        DELETE FROM ${sql.unsafe(SCHEMA)}.shared_items
        WHERE item_id = ${itemId} AND item_type = ${itemType}
      `
    ];
    
    if (userIds.length > 0) {
      for (const userId of userIds) {
        queries.push(
          sql`INSERT INTO ${sql.unsafe(SCHEMA)}.shared_items (item_id, item_type, user_id) VALUES (${itemId}, ${itemType}, ${userId})`
        );
      }
    }

    // @ts-ignore The library expects an array of query objects for transactions.
    await sql.transaction(queries);
  }),
};