import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';

export default function(token): string {
    try {
        const int = jwt.verify(token, process.env.SigningSecret);

        console.error('AUTH', int);
    } catch (err) {
        throw new Err(401, err, 'Invalid Token');
    }
}
