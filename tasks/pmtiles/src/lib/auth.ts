import Err from '@openaddresses/batch-error';

export default function(token) {
    try {
        jwt.verify(token, process.env.SigningSecret);
    } catch (err) {
        throw new Err(401, err, 'Invalid Token');
    }
}
