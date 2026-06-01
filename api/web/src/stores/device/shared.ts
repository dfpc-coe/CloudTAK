export function hasPermissionQuery(): boolean {
    return 'permissions' in navigator && typeof navigator.permissions?.query === 'function';
}

export async function queryPermissionStatus(name: string, warning: string): Promise<PermissionStatus | null> {
    if (!hasPermissionQuery()) return null;

    try {
        return await navigator.permissions.query({ name } as PermissionDescriptor);
    } catch (err) {
        console.warn(warning, err);
        return null;
    }
}