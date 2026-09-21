import Err from '@openaddresses/batch-error';

/** Rethrow a Postgres unique constraint violation (23505) as a 400 with the given message */
export function uniqueViolation(message: string): (err: unknown) => never {
    return (err: unknown) => {
        const cause = err instanceof Error ? err.cause : undefined;

        if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505') {
            throw new Err(400, err instanceof Error ? err : null, message);
        }

        throw err;
    };
}
