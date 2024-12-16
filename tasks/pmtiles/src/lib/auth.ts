import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';

export type JWTToken = {
    access: string
    email: string
    iat: number
}

export default function(token): string {
    try {
        return jwt.verify(token, process.env.SigningSecret) as JWTToken;
    } catch (err) {
        throw new Err(401, err, 'Invalid Token');
    }
}
