import { GoogleGenAI } from "@google/genai";
import { Agent, AgentConfig, Tool, ChatMessage, ExecutionLog, Guardrail } from "../types";
import { dbService } from "./db";

export const embeddingService = {
  async embed(texts: string[]): Promise<number[][]> {
    const engines = await dbService.getEnginesWithKeys();
    const googleEngine = engines.find(e => e.name === 'GoogleAI');
    if (!googleEngine || !googleEngine.api_key) {
      throw new Error('Google AI API key not configured in Settings.');
    }

    const ai = new GoogleGenAI({ apiKey: googleEngine.api_key });

    const allEmbeddings: number[][] = [];
    for (const text of texts) {
      try {
        const result = await ai.models.embedContent({
          model: "text-embedding-004",
          contents: {
            parts: [{ text: text }],
          },
        });
        allEmbeddings.push(result.embeddings[0].values);
      } catch (error) {
        console.error("Google Embedding API Error:", error);
        throw new Error(`Embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return allEmbeddings;
  }
};


type AIResponse = { text?: string; functionCalls?: any[]; knowledgeBaseInfo?: ExecutionLog['knowledgeBaseInfo'] };

export class AIService {
  private async getApiKey(engineName: string): Promise<string> {
    const engines = await dbService.getEnginesWithKeys();
    const engine = engines.find(e => e.name === engineName);
    if (!engine || !engine.api_key) {
      throw new Error(`API Key for ${engineName} not found. Please configure it in the Settings.`);
    }
    return engine.api_key;
  }

  private async withRetry<T>(apiCall: () => Promise<T>, maxRetries = 5, initialDelay = 10000): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        lastError = error;
        
        let isRetryable = false;
        
        const errorMessage = (error?.message || '').toLowerCase();
        const errorString = error ? String(error).toLowerCase() : '';
        const errorBody = (() => {
          try { return JSON.stringify(error).toLowerCase(); }
          catch { return ''; }
        })();

        if (errorMessage.includes('failed to fetch') || errorString.includes('failed to fetch')) {
            isRetryable = true;
        }

        const rateLimitKeywords = ['429', 'resource_exhausted', 'rate_limit_exceeded', 'quota'];
        if (rateLimitKeywords.some(kw => errorMessage.includes(kw) || errorString.includes(kw) || errorBody.includes(kw))) {
            isRetryable = true;
        }
        
        if (isRetryable && attempt < maxRetries - 1) {
          const delay = initialDelay * (2 ** attempt) + Math.floor(Math.random() * 1000);
          console.warn(
            `AI Service call failed with retryable error. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt + 1}/${maxRetries})`,
            error
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error("AI Service Error (non-retryable or final attempt):", error);
          throw error; 
        }
      }
    }
    console.error(`AI API call failed after ${maxRetries} retries.`, lastError);
    throw lastError;
  }
  
  private async _applyGuardrails(text: string, guardrails: Guardrail[], applyTo: 'input' | 'output', aiEngine: string, apiKey: string): Promise<string> {
    if (!text) return '';
    const relevantGuardrails = guardrails.filter(g => (applyTo === 'input' ? g.appliesToInput : g.appliesToOutput));
    if (relevantGuardrails.length === 0) return text;

    // --- Blocking Checks (run on original text) ---
    // 1. Semantic Guardrails
    if (aiEngine === 'GoogleAI') {
        const semanticGuardrails = relevantGuardrails.filter(g => g.method === 'semantic_classifier' && g.config.categories && g.config.categories.length > 0);
        const allBlockCategories = new Set<string>();
        semanticGuardrails.forEach(g => { g.config.categories?.forEach(c => { if (c.action === 'block') allBlockCategories.add(c.name); }); });

        if (allBlockCategories.size > 0) {
            try {
                const ai = new GoogleGenAI({ apiKey });
                const systemInstruction = `You are a strict content classifier. Your task is to determine if the given text falls into any of the provided restricted categories. Respond with a JSON object: {"is_restricted": true, "category": "CATEGORY_NAME"} if it matches a category, or {"is_restricted": false, "category": null} if it does not. Be very strict in your classification.`;
                const prompt = `Restricted Categories: [${Array.from(allBlockCategories).join(', ')}]\n\nText to Classify:\n"""\n${text}\n"""`;
                const classificationResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ role: "user", parts: [{ text: prompt }] }], config: { systemInstruction, responseMimeType: 'application/json' }});
                const classificationResult = JSON.parse(classificationResponse.text.replace(/```json|```/g, '').trim());
                if (classificationResult.is_restricted === true && classificationResult.category) {
                    throw new Error(`Blocked by semantic guardrail: Detected "${classificationResult.category.replace(/_/g, ' ')}".`);
                }
            } catch (e: any) { throw e; }
        }
    }

    // 2. Keyword Guardrails
    const keywordGuardrails = relevantGuardrails.filter(g => g.method === 'keyword_filter' && g.config.keywords && g.config.keywords.length > 0);
    const blockKeywords: string[] = [];
    const hashKeywords: string[] = [];
    keywordGuardrails.forEach(g => {
      g.config.keywords?.forEach(k => {
        if (k.action === 'block') blockKeywords.push(k.value);
        else if (k.action === 'hash') hashKeywords.push(k.value);
      });
    });

    if (blockKeywords.length > 0) {
      const pattern = blockKeywords.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
      const regex = new RegExp(`(${pattern})`, 'i');
      const match = text.match(regex);
      if (match) { throw new Error(`Blocked by keyword guardrail: Restricted term "${match[1]}" found.`); }
    }

    // --- Modification Checks (run after blocking is complete) ---
    let processedText = text;
    if (hashKeywords.length > 0) {
      const pattern = hashKeywords.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
      const regex = new RegExp(`(${pattern})`, 'gi');
      processedText = processedText.replace(regex, (match) => `[HASH:${btoa(match)}]`);
    }

    return processedText;
  }


  private async _generateGemini(ai: GoogleGenAI, model: string, systemInstruction: string, prompt: string, config: Partial<AgentConfig>, responseMimeType?: string): Promise<AIResponse> {
    const genAIConfig: any = {
      systemInstruction,
      temperature: config.temperature,
      topP: config.topP,
    };
    if (responseMimeType) {
      genAIConfig.responseMimeType = responseMimeType;
    }
    
    const request: any = {
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: genAIConfig,
    };

    try {
        const response = await ai.models.generateContent(request);
        return { text: response.text };
    } catch (e: any) {
        throw e;
    }
  }

  private async _generateOpenAI(apiKey: string, model: string, systemInstruction: string, prompt: string, config: Partial<AgentConfig>): Promise<AIResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: config.temperature,
        top_p: config.topP,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API Error: ${errorData.error.message}`);
    }
    const data = await response.json();
    return { text: data.choices[0].message.content };
  }

  private async _generateAnthropic(apiKey: string, model: string, systemInstruction: string, prompt: string, config: Partial<AgentConfig>): Promise<AIResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemInstruction,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature,
        top_p: config.topP,
        max_tokens: 4096,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Anthropic API Error: ${errorData.error.message}`);
    }
    const data = await response.json();
    return { text: data.content[0].text };
  }

  private async _generateMeta(apiKey: string, model: string, systemInstruction: string, prompt: string, config: Partial<AgentConfig>): Promise<AIResponse> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: config.temperature,
        top_p: config.topP,
      }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Meta (Groq) API Error: ${errorData.error.message}`);
    }
    const data = await response.json();
    return { text: data.choices[0].message.content };
  }
  
  async generate(
    agentConfig: AgentConfig,
    systemInstruction: string,
    prompt: string,
    responseMimeType?: "application/json" | "text/plain",
    tools?: Tool[],
    humanFeedback?: string,
    knowledgeBaseIds?: string[],
    agentId?: string
  ): Promise<AIResponse> {
    const finalAgentConfig = { ...agentConfig };

    if (finalAgentConfig.aiEngine === 'GoogleAI') {
      const modelMapping: { [key: string]: string } = {
        'gemini-1.5-flash': 'gemini-3-flash-preview',
        'gemini-1.5-pro': 'gemini-3-pro-preview',
      };
      if (modelMapping[finalAgentConfig.model]) {
        const oldModel = finalAgentConfig.model;
        finalAgentConfig.model = modelMapping[oldModel];
        console.warn(`Model '${oldModel}' is outdated. Automatically upgraded to '${finalAgentConfig.model}'.`);
      }
    }
    
    const allGuardrails = await dbService.getGuardrails();
    const defaultGuardrails = allGuardrails.filter(g => g.isDefault);
    let activeGuardrails: Guardrail[] = [];
    
    if (agentId) {
        const agent = (await dbService.getAgents()).find(a => a.id === agentId);
        const activeGuardrailIds = new Set<string>();
        defaultGuardrails.forEach(g => activeGuardrailIds.add(g.id));
        agent?.guardrailIds?.forEach(id => activeGuardrailIds.add(id));
        activeGuardrails = allGuardrails.filter(g => activeGuardrailIds.has(g.id));
    } else {
        activeGuardrails = defaultGuardrails;
    }
    
    const apiKey = await this.getApiKey(finalAgentConfig.aiEngine);
    const processedPrompt = await this._applyGuardrails(prompt, activeGuardrails, 'input', finalAgentConfig.aiEngine, apiKey);
    
    const { model, aiEngine, ...config } = finalAgentConfig;
    
    return this.withRetry(async () => {
      let ai: GoogleGenAI | undefined;
      if (aiEngine === 'GoogleAI') {
          ai = new GoogleGenAI({ apiKey });
      }
      
      let finalSystemInstruction = systemInstruction;
      let knowledgeBaseInfo: AIResponse['knowledgeBaseInfo'] | undefined = undefined;

      if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
        try {
          const [queryVector] = await embeddingService.embed([processedPrompt]);
          const searchResults = await dbService.searchKnowledgeBaseChunks(knowledgeBaseIds, queryVector, 5);
          if (searchResults.length > 0) {
            knowledgeBaseInfo = {
              usedKbIds: knowledgeBaseIds,
              retrievedDocs: searchResults.map(r => ({ file_name: r.file_name })),
            };
            const context = searchResults.map(r => r.content).join('\n\n---\n\n');
            finalSystemInstruction = `You have the following information from a knowledge base to help you answer the user's request:\n\n"""\n${context}\n"""\n\nBased on this information, and your own knowledge, respond to the user.\n\nOriginal instructions for you:\n${systemInstruction}`;
          }
        } catch (e) { console.error("Failed to retrieve from knowledge base:", e); }
      }

      if (humanFeedback) {
        finalSystemInstruction = `${finalSystemInstruction}\n\n--- HUMAN FEEDBACK ---\nRevise your output based on this feedback:\n${humanFeedback}`;
      }
      
      let response: AIResponse;
      switch (aiEngine) {
        case 'GoogleAI':
          response = await this._generateGemini(ai!, model, finalSystemInstruction, processedPrompt, config, responseMimeType);
          break;
        case 'OpenAI':
          response = await this._generateOpenAI(apiKey, model, finalSystemInstruction, processedPrompt, config);
          break;
        case 'Anthropic':
          response = await this._generateAnthropic(apiKey, model, finalSystemInstruction, processedPrompt, config);
          break;
        case 'Meta':
          response = await this._generateMeta(apiKey, model, finalSystemInstruction, processedPrompt, config);
          break;
        default:
          throw new Error(`Unsupported AI Engine: ${aiEngine}`);
      }
      
      const processedResponseText = await this._applyGuardrails(response.text || '', activeGuardrails, 'output', aiEngine, apiKey);
      
      return { ...response, text: processedResponseText, knowledgeBaseInfo };
    });
  }

  async testGuardrail(guardrail: Guardrail, text: string, type: 'input' | 'output'): Promise<{ blocked: boolean; reason: string }> {
    if (guardrail.method === 'keyword_filter') {
        if (!guardrail.config.keywords || guardrail.config.keywords.length === 0) { return { blocked: false, reason: 'No keywords to check.' }; }
        let processedText = text; const blockKeywords = guardrail.config.keywords.filter(k => k.action === 'block').map(k => k.value); const hashKeywords = guardrail.config.keywords.filter(k => k.action === 'hash').map(k => k.value);
        if (blockKeywords.length > 0) { const pattern = blockKeywords.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|'); const regex = new RegExp(`(${pattern})`, 'i'); const match = processedText.match(regex); if (match) { return { blocked: true, reason: `Text blocked by guardrail "${guardrail.name}": Restricted term "${match[1]}" found.` }; } }
        let hashed = false; if (hashKeywords.length > 0) { const pattern = hashKeywords.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|'); const regex = new RegExp(`(${pattern})`, 'gi'); if (regex.test(processedText)) { hashed = true; processedText = processedText.replace(regex, (match) => `[HASH:${btoa(match)}]`); } }
        if (hashed) { return { blocked: false, reason: `Text was hashed by the guardrail. The processed text is:\n\n---\n\n${processedText}` }; }
        return { blocked: false, reason: `Text passed keyword filter "${guardrail.name}".` };
    }

    if (guardrail.method === 'semantic_classifier') {
        const apiKey = await this.getApiKey('GoogleAI');
        const ai = new GoogleGenAI({ apiKey });
        const categories = guardrail.config.categories;
        if (!categories || categories.length === 0) { return { blocked: false, reason: 'No semantic categories to check.' }; }
        const blockCategories = categories.filter(c => c.action === 'block');
        if (blockCategories.length === 0) { return { blocked: false, reason: 'No categories are set to "Block". Text is allowed.' }; }
        
        const blockCategoryNames = blockCategories.map(c => c.name);
        const systemInstruction = `You are a strict content classifier. Your task is to determine if the given text falls into any of the provided restricted categories. Respond with a JSON object: {"is_restricted": true, "category": "CATEGORY_NAME"} if it matches a category, or {"is_restricted": false, "category": null} if it does not. Be very strict in your classification.`;

        try {
            if (type === 'input') {
                const prompt = `Restricted Categories: [${blockCategoryNames.join(', ')}]\n\nText to Classify:\n"""\n${text}\n"""`;
                const classificationResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ role: "user", parts: [{ text: prompt }] }], config: { systemInstruction, responseMimeType: 'application/json' }});
                const classificationResult = JSON.parse(classificationResponse.text.replace(/```json|```/g, '').trim());

                if (classificationResult.is_restricted === true && classificationResult.category) {
                    return { blocked: true, reason: `Input blocked by semantic guardrail: Detected "${classificationResult.category.replace(/_/g, ' ')}".` };
                }
                return { blocked: false, reason: 'Input passed all semantic checks.' };
            } else { // type === 'output'
                const generationResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ role: "user", parts: [{ text }] }] });
                const generatedText = generationResponse.text;
                if (!generatedText) {
                    return { blocked: false, reason: "Model did not generate any text to test." };
                }

                const outputPrompt = `Restricted Categories: [${blockCategoryNames.join(', ')}]\n\nText to Classify:\n"""\n${generatedText}\n"""`;
                const outputClassificationResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ role: "user", parts: [{ text: outputPrompt }] }], config: { systemInstruction, responseMimeType: 'application/json' }});
                const outputClassificationResult = JSON.parse(outputClassificationResponse.text.replace(/```json|```/g, '').trim());

                if (outputClassificationResult.is_restricted === true && outputClassificationResult.category) {
                    return { blocked: true, reason: `Generated output was blocked by semantic guardrail: Detected "${outputClassificationResult.category.replace(/_/g, ' ')}".\n\n**Generated Output:**\n\n---\n\n${generatedText}` };
                }
                return { blocked: false, reason: `Generated output passed semantic check.\n\n**Generated Output:**\n\n---\n\n${generatedText}` };
            }
        } catch (e: any) {
            console.error("Error during semantic guardrail test:", e);
            return { blocked: true, reason: `An unexpected error occurred during semantic classification: ${e.message}` };
        }
    }
    return { blocked: false, reason: `Guardrail method "${guardrail.method}" not supported for testing.` };
  }
  
  private async _chatGemini(apiKey: string, model: string, systemInstruction: string, history: ChatMessage[]): Promise<AIResponse> {
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
        model,
        history: history.slice(0, -1).map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
        })),
        config: { systemInstruction }
    });
    const userMessage = history[history.length - 1].content;
    const result = await chat.sendMessage({ message: userMessage });
    return { text: result.text };
  }

  private async _chatMeta(apiKey: string, model: string, systemInstruction: string, history: ChatMessage[]): Promise<AIResponse> {
      const messages = [
          { role: 'system', content: systemInstruction },
          ...history.map(msg => ({
              role: msg.role === 'model' ? 'assistant' : 'user',
              content: msg.content
          }))
      ];

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
              model,
              messages,
          }),
      });
      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Meta (Groq) API Error: ${JSON.stringify(errorData.error)}`);
      }
      const data = await response.json();
      return { text: data.choices[0].message.content };
  }

  async chat(modelId: string, history: ChatMessage[], systemInstruction: string): Promise<AIResponse> {
    const allModels = await dbService.getModels();
    const modelInfo = allModels.find(m => m.id === modelId);
    if (!modelInfo) {
        throw new Error(`Model ${modelId} not found.`);
    }

    const allEngines = await dbService.getEnginesWithKeys();
    const engineInfo = allEngines.find(e => e.id === modelInfo.engine_id);
    if (!engineInfo) {
        throw new Error(`Engine for model ${modelId} not found.`);
    }

    const apiKey = engineInfo.api_key;
    if (!apiKey) {
      throw new Error(`API Key for ${engineInfo.name} not found.`);
    }
    
    const allGuardrails = await dbService.getGuardrails();
    const activeGuardrails = allGuardrails.filter(g => g.isDefault);
    
    const userMessage = history[history.length - 1];
    if (userMessage.role === 'user') {
      userMessage.content = await this._applyGuardrails(userMessage.content, activeGuardrails, 'input', engineInfo.name, apiKey);
    }
    
    return this.withRetry(async () => {
        let response: AIResponse;
        switch (engineInfo.name) {
            case 'GoogleAI':
                response = await this._chatGemini(apiKey, modelId, systemInstruction, history);
                break;
            case 'Meta':
                response = await this._chatMeta(apiKey, modelId, systemInstruction, history);
                break;
            default:
                throw new Error(`Chat not implemented for engine: ${engineInfo.name}`);
        }
        
        response.text = await this._applyGuardrails(response.text || '', activeGuardrails, 'output', engineInfo.name, apiKey);
        return response;
    });
  }
}

export const geminiService = new AIService();