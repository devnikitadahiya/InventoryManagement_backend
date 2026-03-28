module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'server.js',
    '!**/node_modules/**',
  ],
};
