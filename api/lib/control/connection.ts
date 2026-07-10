import { X509Certificate } from 'crypto';

export default class ConnectionControl {
    /**
     * Compute the TAK UID for a Machine Connection from its client
     * certificate, matching the identity the pooled connection would present
     */
    static uid(cert: string): string {
        const x509 = new X509Certificate(cert);
        return (x509.subject || '').split('\n').reverse().join(',');
    }
}
