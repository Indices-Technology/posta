import { defineConfig } from 'vitest/config'

// Unit tests cover pure server logic (rules, matching), so plain Node is enough.
// Tests live next to the code they test, in __tests__/*.spec.ts (same as MarketX).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['layers/**/__tests__/*.spec.ts', 'shared/**/__tests__/*.spec.ts'],
  },
})
