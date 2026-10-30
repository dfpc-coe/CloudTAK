import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';

export type JWTToken = {
    access: string;
    email: string;
    /** Optional file-scoped grant: '{username}/{file}' the token may access. */
    file?: string;
    iat: number;
};

export default function (token: string): JWTToken {
    try {
        return jwt.verify(token, process.env.SigningSecret!) as JWTToken;
    } catch (err) {
        throw new Err(401, err instanceof Error ? err : new Error(String(err)), 'Invalid Token');
    }
}

/**
 * Returns true if the token grants access to `profile/{username}/{file}`.
 * Access is granted when the token is for the file owner, or carries a
 * `file` claim matching the requested path (for channel-shared files).
 */
export function tokenGrantsFile(token: JWTToken, username: string, file: string): boolean {
    if (token.access !== 'profile') return false;
    if (token.email === username) return true;
    return token.file === `${username}/${file}`;
}

export const USER_ACCESS = ['admin', 'agency', 'user'] as const;
export const RESOURCE_ACCESS = ['data', 'layer', 'import', 'lease', 'basemap', 'connection', 'media', 'profile'] as const;

export type AuthUser = {
    kind: 'user';
    token: string;
    email: string;
    access: typeof USER_ACCESS[number];
};

export type AuthResource = {
    kind: 'resource';
    token: string;
    access: typeof RESOURCE_ACCESS[number];
    id: number | string | undefined;
    internal: boolean;
};

export type Auth = AuthUser | AuthResource;

/**
 * Parse a CloudTAK user session token or an `etl.` prefixed resource token,
 * mirroring the CloudTAK API tokenParser. ETL profile tokens require a
 * database lookup in the API and are rejected here.
 */
export function tokenParser(raw: string): Auth {
    if (raw.startsWith('etl.')) {
        const decoded = jwt.verify(raw.replace(/^etl\./, ''), process.env.SigningSecret!) as jwt.JwtPayload;

        if (!decoded.access || typeof decoded.access !== 'string') throw new Err(401, null, 'Invalid Token');
        const internal = typeof decoded.internal === 'boolean' ? decoded.internal : false;
        if (!internal && !decoded.id) throw new Err(401, null, 'Invalid Token');

        const access = RESOURCE_ACCESS.find(a => a === String(decoded.access).toLowerCase());
        if (!access) throw new Err(400, null, 'Invalid Resource Access Value');

        if (access === 'profile') throw new Err(401, null, 'Invalid Token');

        return {
            kind: 'resource',
            token: raw,
            access,
            id: decoded.id,
            internal,
        };
    }

    const decoded = jwt.verify(raw, process.env.SigningSecret!) as jwt.JwtPayload;

    if (!decoded.email || typeof decoded.email !== 'string') throw new Err(401, null, 'Invalid Token');
    if (!decoded.access || typeof decoded.access !== 'string') throw new Err(401, null, 'Invalid Token');

    const access = USER_ACCESS.find(a => a === String(decoded.access).toLowerCase());
    if (!access) throw new Err(400, null, 'Invalid User Access Value');

    return {
        kind: 'user',
        token: raw,
        email: decoded.email,
        access,
    };
}

/**
 * Resolve the request token from the Authorization header or `?token=`,
 * mirroring the CloudTAK API auth_request + is_auth resource checks.
 */
export function authRequest(
    req: {
        header: (name: string) => string | undefined;
        query?: unknown;
    },
    opts: {
        resources?: Array<{ access: AuthResource['access']; id?: number | string }>;
    } = {},
): Auth {
    let auth: Auth;

    try {
        const header = req.header('authorization');

        if (header) {
            const authorization = header.split(' ');

            if (authorization[0].toLowerCase() !== 'bearer') {
                throw new Err(401, null, 'Only "Bearer" authorization header is allowed');
            }

            if (!authorization[1]) {
                throw new Err(401, null, 'No bearer token present');
            }

            auth = tokenParser(authorization[1]);
        } else if (
            req.query
            && typeof req.query === 'object'
            && typeof (req.query as Record<string, unknown>).token === 'string'
        ) {
            auth = tokenParser((req.query as Record<string, string>).token);
        } else {
            throw new Err(401, null, 'No Auth Present');
        }
    } catch (err) {
        if (err instanceof Error && err.name === 'PublicError') {
            throw err;
        } else {
            throw new Err(401, new Error(String(err)), 'Invalid Token');
        }
    }

    if (auth.kind === 'resource') {
        const resources = opts.resources || [];
        const allowed = resources.some((r) => {
            if (r.id !== undefined) return r.access === auth.access && r.id === auth.id;
            return r.access === auth.access;
        });

        if (!allowed) throw new Err(403, null, 'Resource token cannot access this resource');
    }

    return auth;
}
