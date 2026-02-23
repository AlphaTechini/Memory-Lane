module.exports = {
    apps: [
        {
            name: 'rag-engine',
            script: './rag-server',
            cwd: './rag-engine',
            env: {
                PORT: '8081',
                STORAGE_BACKEND: 'dynamodb',
                AWS_REGION: 'eu-north-1'
            },
            autorestart: true,
            watch: false
        },
        {
            name: 'backend',
            script: './src/index.js',
            cwd: './backend',
            env: {
                PORT: '3000',
                RAG_ENGINE_URL: 'http://localhost:8081',
                NODE_ENV: 'production'
            },
            autorestart: true,
            watch: false
        }
    ]
};
