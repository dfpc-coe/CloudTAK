import { vi } from 'vitest'

// Mock localStorage with proper setItem implementation
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    // Support direct property assignment as well
    set token(value) {
      this.setItem('token', value)
    },
    get token() {
      return this.getItem('token')
    },
  },
  writable: true,
})

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:8080',
    href: 'http://localhost:8080',
    pathname: '/',
    search: '',
  },
  writable: true,
})

// Mock process.env for the API_URL
globalThis.process = {
  ...globalThis.process,
  env: {
    API_URL: 'http://localhost:5001',
  },
} as any

// Mock self for workers
if (typeof self === 'undefined') {
  (globalThis as any).self = globalThis
}
