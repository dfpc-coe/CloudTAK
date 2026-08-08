import Err from '@openaddresses/batch-error';

type StatusError = Error & {
    status?: number;
    statusCode?: number;
    safe?: string;
};

export function toError(err: unknown): Error {
    if (err instanceof Error) return err;

    return new Error(String(err));
}

export function toErr(err: unknown, status?: number, safe?: string, print = true): Err {
    if (err instanceof Err && status === undefined && safe === undefined) {
        return err;
    }

    const error = toError(err) as StatusError;
    const statusCode = status
        ?? (Number.isFinite(Number(error.status)) ? Number(error.status) : undefined)
        ?? (Number.isFinite(Number(error.statusCode)) ? Number(error.statusCode) : undefined)
        ?? 500;

    return new Err(statusCode, error, safe ?? error.safe ?? 'Internal Server Error', print);
}
