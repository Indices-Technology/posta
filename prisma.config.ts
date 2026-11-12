import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    // CLI only (the app connects in server/utils/db.ts). Migrations take a lock the transaction
    // pooler (:6543) can't hold, so `migrate deploy` hangs on it: set DIRECT_URL to the :5432 URL.
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
})
