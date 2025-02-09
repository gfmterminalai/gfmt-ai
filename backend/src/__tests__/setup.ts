// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Mock environment variables if not provided
process.env.FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || 'test-api-key';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';

// Global beforeAll hook
beforeAll(() => {
  // Add any global test setup here
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// Global afterAll hook
afterAll(() => {
  // Clean up any global test setup
  jest.restoreAllMocks();
});

// Global beforeEach hook
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
}); 