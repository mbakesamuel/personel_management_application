module.exports = {
  apps: [
    {
      name: 'personel-management-server',
      script: 'dist/index.js',
      cwd: '/home/server_admin/personel_management_application/packages/server',
      // Absolute path so boot (which selects Node 23 for the other apps)
      // still runs this API on Node 24, which Prisma 7 requires.
      interpreter: '/home/server_admin/.nvm/versions/node/v24.21.0/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
