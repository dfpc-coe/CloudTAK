import { parentPort } from 'worker_threads';

parentPort.on('message', (message) => {
    try {
        console.error(message)
    } catch (err) {
        parentPort.postMessage({
            type: 'error',
            error: err
        });
    }
});
