/** Distinguishes a deadline expiry from the operation's own failure. */
export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
    }
}

/**
 * Bound a promise to a deadline, rejecting with a TimeoutError if it does
 * not settle in time. The underlying operation is not cancelled — if it
 * settles after the deadline its result is simply unused — but callers are
 * guaranteed an answer, which keeps boot-critical paths from wedging on a
 * hung network request, IndexedDB transaction, or native bridge call.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    // If the promise loses the race, its eventual rejection must not surface
    // as an unhandled rejection.
    promise.catch(() => { /* handled by the race */ });

    try {
        return await Promise.race([promise, deadline]);
    } finally {
        clearTimeout(timer);
    }
}
