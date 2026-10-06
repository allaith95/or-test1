module.exports = {
  apps: [
    {
      name: 'orca-express-server',
      script: 'server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
