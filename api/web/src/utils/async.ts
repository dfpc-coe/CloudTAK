export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
    }
}

/**
 * Bound a promise to a deadline, rejecting with a TimeoutError if it does
 * not settle in time. The underlying operation is not cancelled; its result
 * is simply unused if it settles late.
 */
export async function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    // Comlink property proxies (e.g. worker.initialized) are thenables that
    // only implement `then` - accessing `.catch` on one forwards it to the
    // worker as a remote call whose argument is the callback function itself,
    // which postMessage cannot clone (DataCloneError). Assimilate to a real
    // Promise before attaching handlers.
    const settled = Promise.resolve(promise);

    // A late rejection from the losing promise must not go unhandled.
    settled.catch(() => { /* handled by the race */ });

    try {
        return await Promise.race([settled, deadline]);
    } finally {
        clearTimeout(timer);
    }
}
