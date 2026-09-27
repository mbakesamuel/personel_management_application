module.exports = {
  apps: [
    {
      name: 'personel-management-server',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        // DB_TARGET comes from .env (dev | prod) via dotenv
      },
    },
  ],
}
