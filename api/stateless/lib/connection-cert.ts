import Err from '@openaddresses/batch-error';
import type { InferSelectModel } from 'drizzle-orm';
import type Config from '../../common/config.js';
import type { Connection } from '../../common/schema.js';
import AuthentikProvider, { machineUsernameForConnection } from './authentik-provider.js';
import { needsCertRenewal } from './cert-health.js';
export type ConnectionRow = InferSelectModel<typeof Connection>;
export type RenewResult = {
    renewed: boolean;
    message: string;
};
/** Machine-user certificates are issued by Authentik + TAK Server; without Authentik there is nothing to renew with */
export function certRenewalConfigured(): boolean {
    return !!process.env.AUTHENTIK_URL && !!process.env.AUTHENTIK_API_TOKEN_SECRET_ARN;
}
/**
 * Issue a new client certificate for a connection's machine user and store it on the connection.
 * Does not touch the live connection: the caller rebuilds it (hub.connectionSync with force).
 *
 * Without `force` this only renews certificates in the last days of their life; `force` renews a
 * certificate that is still valid, which is what a rejected one (reset or retired CA) looks like
 */
export async function renewConnectionCert(
    config: Config,
    connection: ConnectionRow,
    opts: { force?: boolean } = {},
): Promise<RenewResult> {
    if (!certRenewalConfigured()) {
        return { renewed: false, message: 'Certificate renewal only supported with Authentik provider' };
    }
    if (!opts.force && !needsCertRenewal(connection.auth.cert)) {
        return { renewed: false, message: 'Certificate does not need renewal' };
    }
    // connection.username is the creator's login, not the machine user
    const machineName = machineUsernameForConnection(connection);
    if (!machineName) throw new Err(400, null, 'Connection is not managed by a Machine User');
    const authentik = await AuthentikProvider.init(config);
    const machineUser = await authentik.fetchMachineUser(0, machineName);
    const renewed = await authentik.renewConnectionCertificate(machineUser.id, String(config.server.api));
    await config.models.Connection.commit(connection.id, {
        auth: {
            ...connection.auth,
            cert: renewed.cert,
            key: renewed.key,
            ca: renewed.ca.length ? renewed.ca : connection.auth.ca,
        },
    });
    return { renewed: true, message: `Certificate renewed for connection ${connection.id}` };
}
