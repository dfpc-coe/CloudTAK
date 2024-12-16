import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';

export type JWTToken = {
    access: string
    email: string
    iat: number
}

export default function(token: string): JWTToken {
    try {
        return jwt.verify(token, process.env.SigningSecret!) as JWTToken;
    } catch (err) {
        throw new Err(401, err instanceof Error ? err : new Error(String(err)), 'Invalid Token');
    }
}
