import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Small pool per running copy. On serverless hosts (Vercel) every instance opens its own pool, and
// Supabase's session pooler allows 15 clients in total, so 10 per copy ran out with two copies up.
// Raise DATABASE_POOL_MAX on a single long-running server; keep it small on serverless.
const max = Number(process.env.DATABASE_POOL_MAX) || 3 // unset, empty or junk → 3, never a pool of 0

// Reused across dev hot reloads so we don't open a new pool on every save.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max, idleTimeoutMillis: 10_000 }) })

globalForPrisma.prisma = prisma
