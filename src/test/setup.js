// Shared test setup for Vitest + React Testing Library.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL's automatic cleanup only registers itself when test globals are
// enabled; we keep globals off, so unmount after every test explicitly.
afterEach(() => {
    cleanup();
});
