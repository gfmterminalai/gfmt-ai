import '@jest/globals';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidUrl(): R;
    }
  }
} 