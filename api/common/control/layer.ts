import Err from '@openaddresses/batch-error';
import type { StaticCapabilitiesDocument } from '@tak-ps/etl';
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
                throw new Err(400, null, `Unknown Permission: ${permission} - Permissions must be one of: ${known}`);
            }
        }
    }

    /**
     * Ensure a set of Layer permissions is consistent with the Permissions a Task's
     * Capabilities document declares - every granted permission must be declared and
     * every required permission must be granted
     */
    static validateManifestPermissions(
        permissions: Array<string>,
        capabilities: StaticCapabilitiesDocument,
        task: string,
    ): void {
        const declared = new Map(capabilities.permissions.map(p => [p.resource, p]));

        for (const permission of permissions) {
            if (!declared.has(permission)) {
                throw new Err(400, null, `Permission ${permission} is not declared by ${task} - Declared permissions: ${Array.from(declared.keys()).join(', ') || 'none'}`);
            }
        }

        for (const [resource, permission] of declared) {
            if (permission.required && !permissions.includes(resource)) {
                throw new Err(400, null, `Permission ${resource} is required by ${task}`);
            }
        }
    }
}
