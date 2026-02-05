// Prisma config (commonjs-compatible)
// Keep this file simple so Prisma's parser can load it.
require('dotenv/config');
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: process.env.DATABASE_URL,
    },
});
