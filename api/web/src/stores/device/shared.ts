export class PermissionQuery {
    static hasPermissionQuery(): boolean {
        return 'permissions' in navigator && typeof navigator.permissions?.query === 'function';
    }

    static async queryPermissionStatus(name: string, warning: string): Promise<PermissionStatus | null> {
        if (!PermissionQuery.hasPermissionQuery()) return null;

        try {
            return await navigator.permissions.query({ name } as PermissionDescriptor);
        } catch (err) {
            console.warn(warning, err);
            return null;
        }
    }
}
