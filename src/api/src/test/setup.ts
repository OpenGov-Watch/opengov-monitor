/**
 * Test setup file for Vitest
 */

import { beforeAll, afterAll, afterEach, vi } from "vitest";
import { closeTestDatabase, createTestDatabase } from "./test-db";
import Database from "better-sqlite3";

// Store the test database instance
let testDb: Database.Database;

beforeAll(() => {
  // Create a fresh test database
  testDb = createTestDatabase();
});

afterEach(() => {
  // Reset mocks after each test
  vi.restoreAllMocks();
});

afterAll(() => {
  // Close test database
  closeTestDatabase();
});

// Export for use in tests
export { testDb };
