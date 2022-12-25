// import crypto from 'crypto';

/**
 * Ensure Certs/Keys are encrypted in the database
 * @class
 */
export default class Crypto {
    constructor() {
        // secret = crypto.randomBytes(32); // TODO Remove
        // this.algo = 'aes-256-cbc';
    }

    encrypt() {
        // const cypher = crypto.createCipheriv(this.algo, secret, crypto.randomBytes(32));
        // let encrypted = cipher.update(string, 'utf-8', 'hex');
        // encrypted += cipher.final('hex');
        // return encrypted;
    }

    decrypt() {
        // crypto.createDecipheriv(algorithm, Securitykey, initVector);

    }
}
