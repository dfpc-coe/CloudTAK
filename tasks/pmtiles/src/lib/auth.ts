import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';

export type JWTToken = {
    access: string
    email: string
    /** Optional file-scoped grant: '{username}/{file}' the token may access. */
    file?: string
    iat: number
}

export default function(token: string): JWTToken {
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
