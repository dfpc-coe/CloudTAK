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
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    // A late rejection from the losing promise must not go unhandled.
    promise.catch(() => { /* handled by the race */ });

    try {
        return await Promise.race([promise, deadline]);
    } finally {
        clearTimeout(timer);
    }
}
