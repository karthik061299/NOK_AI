export enum WorkflowType {
  SEQUENTIAL = 'SEQUENTIAL',
  PARALLEL = 'PARALLEL',
  CIRCULAR = 'CIRCULAR',
  HYBRID = 'HYBRID',
  HUMAN_IN_THE_LOOP = 'HUMAN_IN_THE_LOOP'
}

export enum GeminiModel {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview'
}

export interface AgentInput {
  description: string;
  parameter: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  className: string;
  code: string;
  language: 'javascript' | 'python' | 'java';
  parameters: any; // JSON Schema
  created_at?: number;
  updated_at?: number;
  created_by?: string;
  updated_by?: string;
  created_by_email?: string;
  updated_by_email?: string;
  shared_with?: string[];
}

export interface AgentConfig {
  aiEngine: string;
  model: string;
  temperature: number;
  topP: number;
  maxRPM: number;
  maxExecutionTime: number;
  maxIterations: number;
}

export type AgentVersionData = Omit<Agent, 'id' | 'versions' | 'version'>;

export interface AgentVersion {
  version: number;
  name?: string;
  data: AgentVersionData;
  createdAt: number;
  created_by: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  role: string;
  domain: string;
  goal: string;
  backstory: string;
  taskDescription: string;
  inputs: AgentInput[];
  expectedOutput: string;
  outputFileExtension?: string;
  managerCondition?: string;
  config: AgentConfig;
  toolIds?: string[];
  knowledgeBaseIds?: string[];
  guardrailIds?: string[];
  version: number;
  versions?: AgentVersion[];
  created_at?: number;
  updated_at?: number;
  created_by?: string;
  updated_by?: string;
  created_by_email?: string;
  updated_by_email?: string;
  shared_with?: string[];
}

export interface WorkflowMetadata {
  id: string;
  name: string;
  description: string;
  type: WorkflowType;
  useManager: boolean;
  managerModel: string;
  managerTemperature: number;
  managerTopP: number;
  managerMaxIterations?: number;
}

export interface WorkflowNode {
  id: string;
  type: 'agent' | 'human';
  agentId?: string;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface Workflow {
  metadata: WorkflowMetadata;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_at?: number;
  updated_at?: number;
  created_by?: string;
  updated_by?: string;
  created_by_email?: string;
  updated_by_email?: string;
  shared_with?: string[];
}

export interface ExecutionLog {
  id: string;
  execution_id: string;
  timestamp: number;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped' | 'paused';
  input: string;
  output?: string;
  error?: string;
  nodeId: string;
  version?: number;
  toolCalls?: any[];
  workflowId?: string;
  duration?: number;
  knowledgeBaseInfo?: { usedKbIds: string[], retrievedDocs: { file_name: string }[] };
  user_id?: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: 'running' | 'completed' | 'failed' | 'stopped' | 'paused' | 'pending';
  timestamp: number;
  duration?: number;
  user_email?: string;
}

export interface DBModel {
  id: string;
  engine_id: number;
  name: string;
  full_name: string;
  max_tokens: number;
  is_active?: boolean;
}

export interface Engine {
  id: number;
  name: string;
  description?: string;
  is_active?: boolean;
  api_key?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
  timestamp: number;
  user_id: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface FileExtension {
  id: number;
  name: string;
  extension: string;
}

export interface User {
  id: string;
  email: string;
  role: 'Admin' | 'User' | 'Owner';
}

export interface ReportedIssue {
  id: string;
  description: string;
  raised_by_email: string;
  created_at: number;
  status: 'Pending' | 'Resolved' | 'Revoked';
  updated_at?: number;
  updated_by_email?: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  file_names: string[];
  created_at?: number;
  updated_at?: number;
  created_by?: string;
  updated_by?: string;
  created_by_email?: string;
  updated_by_email?: string;
  shared_with?: string[];
}

export type GuardrailMethod = 'keyword_filter' | 'semantic_classifier';
export type GuardrailAction = 'block' | 'hash';

export interface KeywordGuardrailConfig {
  value: string;
  action: GuardrailAction;
}

export interface SemanticGuardrailConfig {
  name: SemanticCategory;
  action: GuardrailAction;
}

export const SemanticCategoryList = [] as const;
export type SemanticCategory = string;

export interface Guardrail {
  id: string;
  name: string;
  description: string;
  appliesToInput: boolean;
  appliesToOutput: boolean;
  method: GuardrailMethod;
  config: {
    keywords?: KeywordGuardrailConfig[];
    categories?: SemanticGuardrailConfig[];
  };
  isDefault: boolean;
  created_at?: number;
  updated_at?: number;
  created_by?: string;
  updated_by?: string;
  created_by_email?: string;
  updated_by_email?: string;
  shared_with?: string[];
}