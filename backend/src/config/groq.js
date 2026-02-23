/**
 * Groq + RAG Engine Configuration
 */

const groqConfig = {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    isConfigured: () => Boolean(process.env.GROQ_API_KEY),
};

const ragEngineConfig = {
    url: process.env.RAG_ENGINE_URL || 'http://localhost:8081',
    timeout: parseInt(process.env.RAG_ENGINE_TIMEOUT || '15000', 10),
    isConfigured: () => Boolean(process.env.RAG_ENGINE_URL),
};

if (groqConfig.isConfigured()) {
    console.log('🧠 GROQ_API_KEY loaded.');
} else {
    console.log('⚠️  GROQ_API_KEY not set — LLM orchestration disabled (stub mode).');
}

console.log(`🔧 RAG Engine URL: ${ragEngineConfig.url}`);

export { groqConfig, ragEngineConfig };
