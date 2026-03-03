module.exports = {
    apps: [
        {
            name: 'rag-engine',
            script: './rag-server',
            cwd: './rag-engine',
            env: {
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production'
            },
            autorestart: true,
            watch: false
        },
        {
            name: 'backend',
            script: './src/index.js',
            cwd: './backend',
            env: {
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production'
            },
            autorestart: true,
            watch: false
        }
    ]
};
