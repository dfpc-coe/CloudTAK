import Err from '@openaddresses/batch-error';

/** Postgres unique violation detail - batch-generic surfaces it as the message of a 400 without keeping the cause */
const UNIQUE_DETAIL = /^Key \(.+\)=\(.*\) already exists\.$/;

/** Rethrow a Postgres unique constraint violation (23505) as a 400 with the given message */
export function uniqueViolation(message: string): (err: unknown) => never {
    return (err: unknown) => {
        // The 400 batch-generic throws does not satisfy instanceof Err here
        if (
            typeof err === 'object' && err !== null
            && 'status' in err && err.status === 400
            && 'safe' in err && typeof err.safe === 'string' && UNIQUE_DETAIL.test(err.safe)
        ) {
            throw new Err(400, err instanceof Error ? err : null, message);
        }

        const cause = err instanceof Error ? err.cause : undefined;

        if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505') {
            throw new Err(400, err instanceof Error ? err : null, message);
        }

        throw err;
    };
}
