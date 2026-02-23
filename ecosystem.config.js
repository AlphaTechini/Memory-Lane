module.exports = {
    apps: [
        {
            name: 'rag-engine',
            script: './rag-engine/rag-server',
            cwd: '.',
            env: {
                PORT: '8081',
                STORAGE_BACKEND: 'mongodb', // or 'dynamodb'
                // RAG_ENGINE_URL: 'http://localhost:8081' // Internal ref
            },
            // Automatically restart if it crashes
            autorestart: true,
            watch: false,
        },
        {
            name: 'backend',
            script: './backend/src/index.js',
            cwd: '.',
            env: {
                PORT: '3000',
                RAG_ENGINE_URL: 'http://localhost:8081',
                NODE_ENV: 'production',
            },
            // Give the Go service a moment to start
            wait_ready: true,
            listen_timeout: 3000,
            autorestart: true,
            watch: false,
        }
    ]
};
