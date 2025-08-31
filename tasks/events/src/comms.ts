/**
 * Convert Interal Events into Worker Events
 *
 * This library is used to ensure that unit tests can be tested
 * and mocks set in a single thread
 */

import { parentPort } from 'worker_threads';
import type { Message } from './types.ts';
import Worker from './worker.ts';

if (!parentPort) {
    throw new Error('This file can only be run as a worker thread');
}

parentPort.on('message', async (message) => {
    const msg: Message = message;

    const worker = new Worker(msg);

    worker.on('success', () => {
        if (!parentPort) {
            throw new Error('This file can only be run as a worker thread');
        }

        parentPort.postMessage({
            type: 'success'
        });
    });

    worker.on('error', (err) => {
        if (!parentPort) {
            throw new Error('This file can only be run as a worker thread');
        }

        parentPort.postMessage({
            type: 'error',
            error: err
        });
    });

    await worker.process();
});
