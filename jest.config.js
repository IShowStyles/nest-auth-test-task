module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.provider.ts',
    '!src/common/config/**',
    '!src/common/db/schema.ts',
    '!src/common/db/db.client.ts',
    '!src/auth/guards/rt.guard.ts',
    '!src/common/auth/**',
  ],
};
