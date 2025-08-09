# Mock Video Server Testing Harness

This document describes the MockVideoServer class that provides a testing harness for intercepting undici requests to the MediaMTX video server in CloudTAK.

## Overview

The MockVideoServer class uses undici's MockAgent functionality to intercept HTTP requests made to the video server and provide mock responses. This allows testing video-related functionality without requiring a real MediaMTX server.

## Features

- **Comprehensive Endpoint Mocking**: Supports all MediaMTX API endpoints used by CloudTAK:
  - `/v3/config/global/get` - Global video server configuration
  - `/v3/paths/list` - List of active video paths
  - `/v3/config/paths/add/{path}` - Add new video path
  - `/v3/paths/get/{path}` - Get path information
  - `/v3/config/paths/get/{path}` - Get path configuration
  - `/v3/config/paths/patch/{path}` - Update path configuration
  - `/v3/config/paths/delete/{path}` - Delete video path
  - `/v3/recordings/get/{path}` - Get recording information

- **Stateful Simulation**: Maintains internal state for paths and configurations
- **Helper Methods**: Provides convenient methods for test setup and manipulation
- **Realistic Responses**: Returns proper MediaMTX-compatible response structures

## Usage

### Basic Setup

```typescript
import MockVideoServer from './mock-video-server.js';

// Create mock server
const mockVideoServer = new MockVideoServer({
    url: 'http://media:8080',
    configured: true
});

// Your test code here...

// Cleanup
mockVideoServer.close();
```

### Working with Paths

```typescript
// Add a path with custom properties
mockVideoServer.addPath('test-stream-123', {
    ready: true,
    tracks: ['video', 'audio'],
    bytesReceived: 1024000,
    bytesSent: 512000,
    readers: [
        { type: 'hls', id: 'viewer-1' },
        { type: 'webrtc', id: 'viewer-2' }
    ]
});

// Set path as ready/not ready
mockVideoServer.setPathReady('test-stream-123', true);

// Add readers to a path
mockVideoServer.addPathReader('test-stream-123', { 
    type: 'rtsp', 
    id: 'rtsp-viewer' 
});
```

### Testing Different Scenarios

```typescript
// Test unconfigured media server
mockVideoServer.setConfigured(false);

// Test specific error responses
mockVideoServer.simulateError('/v3/config/global/get', 500, 'Server Error');

// Reset to clean state
mockVideoServer.reset();
```

## Implementation Details

### Undici Integration

The MockVideoServer uses undici's MockAgent to intercept fetch requests:

```typescript
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

// Store original dispatcher
this.originalDispatcher = getGlobalDispatcher();

// Create and configure mock agent
this.mockAgent = new MockAgent();
this.mockAgent.disableNetConnect();
setGlobalDispatcher(this.mockAgent);
```

### Interceptor Patterns

The class sets up persistent interceptors for all video server endpoints:

```typescript
// Example interceptor for path listing
pool.intercept({
    path: '/v3/paths/list',
    method: 'GET'
}).reply(() => {
    return {
        statusCode: 200,
        data: JSON.stringify({
            pageCount: 1,
            itemCount: this.paths.size,
            items: Array.from(this.paths.values())
        })
    };
}).persist();
```

### Dynamic Response Generation

Responses are generated dynamically based on the current mock state:

```typescript
// Dynamic path retrieval
pool.intercept({
    path: (path) => path.startsWith('/v3/paths/get/'),
    method: 'GET'
}).reply((opts) => {
    const pathId = opts.path.split('/v3/paths/get/')[1];
    const pathData = this.paths.get(pathId);
    
    if (!pathData) {
        return { statusCode: 404, data: JSON.stringify({ error: 'Path not found' }) };
    }
    
    return { statusCode: 200, data: JSON.stringify(pathData) };
}).persist();
```

## API Reference

### Constructor

```typescript
new MockVideoServer(options?: MockVideoServerOptions)
```

Options:
- `url?: string` - Video server URL (default: 'http://media:8080')
- `configured?: boolean` - Whether server should appear configured (default: true)
- `defaultResponses?: boolean` - Set up default interceptors (default: true)

### Methods

#### Path Management
- `addPath(pathId: string, pathData?: Partial<PathListItemData>): void`
- `setPathReady(pathId: string, ready?: boolean): void`
- `addPathReader(pathId: string, reader: { type: string; id: string }): void`

#### Configuration
- `setConfigured(configured: boolean): void`
- `getPool()` - Get the undici MockPool for custom interceptors

#### Testing Utilities
- `simulateError(endpoint: string, statusCode?: number, message?: string): void`
- `reset(): void` - Clear all paths and reset state
- `close(): void` - Restore original dispatcher and cleanup

## Test Examples

See the comprehensive test suite in `mock-video-server.test.ts` for examples of:

- Basic setup and teardown
- Global configuration testing
- Path operations (add, get, list, delete)
- Error handling scenarios
- Helper method usage
- State management and reset functionality

## Integration with Video Service

The mock server is designed to work seamlessly with CloudTAK's VideoServiceControl class:

```typescript
// VideoServiceControl will automatically use the mocked endpoints
const videoControl = new VideoServiceControl(config);
const configuration = await videoControl.configuration(); // Uses mock
const pathInfo = await videoControl.path('test-path'); // Uses mock
```

## Limitations

1. **Global State**: The MockAgent sets global undici dispatcher, so only one mock server should be active at a time
2. **Test Isolation**: Tests should create and dispose of mock servers properly to avoid conflicts
3. **Full Integration**: Complex integration tests may require additional database and authentication mocking

## Future Enhancements

- Support for WebSocket connections (for real-time video events)
- More sophisticated recording simulation
- Performance metrics simulation
- Multi-tenant path isolation testing