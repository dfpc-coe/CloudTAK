import type { ETLTaskCapabilities } from '../types.ts';

/**
 * The user-editable Layer settings a Task's static Capabilities document
 * drives at Layer creation time
 */
export interface CapabilitySettings {
    memory: number;
    timeout: number;
    permissions: Record<string, boolean>;
    incoming: boolean;
    schedule: boolean;
    cron: string;
    webhooks: boolean;
    outgoing: boolean;
}

export function defaultCapabilitySettings(): CapabilitySettings {
    return {
        memory: 256,
        timeout: 120,
        permissions: {},
        incoming: false,
        schedule: false,
        cron: 'rate(5 minutes)',
        webhooks: false,
        outgoing: false,
    };
}

/** Seed settings from the defaults a Capabilities document declares */
export function capabilitySettings(caps: ETLTaskCapabilities): CapabilitySettings {
    const permissions: Record<string, boolean> = {};
    for (const permission of caps.permissions) {
        permissions[permission.resource] = permission.required;
    }

    return {
        memory: caps.compute.memory,
        timeout: caps.compute.timeout,
        permissions,
        incoming: caps.invocations.incoming !== undefined,
        schedule: caps.invocations.incoming?.schedule?.default.enabled ?? false,
        cron: caps.invocations.incoming?.schedule?.default.schedule || 'rate(5 minutes)',
        webhooks: caps.invocations.incoming?.webhook?.default.enabled ?? false,
        outgoing: (caps.invocations.outgoing?.types.length ?? 0) > 0,
    };
}
