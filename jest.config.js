/** @type {import('jest').Config} */
const config = {
  projects: [
    {
      displayName: "node",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/lib/**/*.test.ts",
        "<rootDir>/app/**/*.test.ts",
        "<rootDir>/__tests__/**/*.test.ts",
      ],
      testPathIgnorePatterns: ["/node_modules/", "/.next/", "/lib/client/"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
    },
    {
      displayName: "jsdom",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      testMatch: [
        "<rootDir>/components/**/*.test.tsx",
        "<rootDir>/app/**/*.test.tsx",
        "<rootDir>/lib/client/**/*.test.ts",
      ],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
    },
  ],
};

module.exports = config;
