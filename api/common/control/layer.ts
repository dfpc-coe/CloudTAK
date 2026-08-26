import Err from '@openaddresses/batch-error';
import { PERMISSIONS } from '@tak-ps/etl';

export default class LayerControl {
    /**
     * Ensure every requested Layer permission is a known `<permission>:<level>`
     * pair from the upstream PERMISSIONS object - `<permission>:*` is valid
     * for every permission
     */
    static isValidPermission(resource: string): boolean {
        const separator = resource.indexOf(':');
        if (separator === -1) return false;

        const levels = PERMISSIONS[resource.slice(0, separator)];
        if (!levels) return false;

        const level = resource.slice(separator + 1);
        return level === '*' || levels.includes(level);
    }

    static validatePermissions(permissions?: Array<string>): void {
        if (!permissions) return;

        for (const permission of permissions) {
            if (!this.isValidPermission(permission)) {
                const known = Object.keys(PERMISSIONS).map(p => `${p}:<${PERMISSIONS[p].join('|')}|*>`).join(', ');
                throw new Err(400, null, `Unknown Layer Permission: ${permission} - Permissions must be one of: ${known}`);
            }
        }
    }
}
