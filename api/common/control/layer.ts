import Err from '@openaddresses/batch-error';
import { PERMISSIONS, isValidPermission } from '@tak-ps/etl';

export default class LayerControl {
    /**
     * Ensure every requested Layer permission is a known `<permission>:<level>`
     * pair from the upstream PERMISSIONS object - `<permission>:*` is valid
     * for every permission
     */
    static validatePermissions(permissions?: Array<string> | null): void {
        if (!permissions) return;

        for (const permission of permissions) {
            if (!isValidPermission(permission)) {
                const known = Object.keys(PERMISSIONS).map(p => `${p}:<${PERMISSIONS[p].join('|')}|*>`).join(', ');
                throw new Err(400, null, `Unknown Layer Permission: ${permission} - Permissions must be one of: ${known}`);
            }
        }
    }
}
