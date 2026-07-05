import jwt from 'jsonwebtoken';

export interface RetentionTaskConfig {
    'retention::enabled'?: boolean;
    'retention::connection-feature::enabled'?: boolean;
    'retention::chat::enabled'?: boolean;
    'retention::import::enabled'?: boolean;
    'retention::feature::enabled'?: boolean;
}

export interface RetentionTaskResult {
    name: string;
    status: 'success' | 'error';
    deleted: number;
    duration: number;
    message?: string;
}

export interface RetentionTask {
    name: string;
    enabled?: (config: RetentionTaskConfig) => boolean;
    run: () => Promise<RetentionTaskResult>;
}

async function postRetention(action: string): Promise<RetentionTaskResult> {
    const apiUrl = process.env.API_URL;
    const signingSecret = process.env.SigningSecret;

    if (!apiUrl || !signingSecret) {
        throw new Error('API_URL or SigningSecret not set');
    }

    const res = await fetch(new URL('/api/retention', apiUrl), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt.sign({ access: 'admin', email: 'system' }, signingSecret, { expiresIn: '5m' })}`,
        },
        body: JSON.stringify({
            action,
        }),
    });

    if (!res.ok) {
        throw new Error(`Failed to execute ${action} retention: HTTP ${res.status}`);
    }

    return await res.json() as RetentionTaskResult;
}

export const tasks: RetentionTask[] = [{
    name: 'connection-feature',
    enabled: (config: RetentionTaskConfig): boolean => {
        return config['retention::connection-feature::enabled'] !== false;
    },
    run: async (): Promise<RetentionTaskResult> => {
        return await postRetention('connection-feature');
    },
}, {
    name: 'chat',
    enabled: (config: RetentionTaskConfig): boolean => {
        return config['retention::chat::enabled'] === true;
    },
    run: async (): Promise<RetentionTaskResult> => {
        return await postRetention('chat');
    },
}, {
    name: 'import',
    enabled: (config: RetentionTaskConfig): boolean => {
        return config['retention::import::enabled'] === true;
    },
    run: async (): Promise<RetentionTaskResult> => {
        return await postRetention('import');
    },
}, {
    name: 'feature',
    enabled: (config: RetentionTaskConfig): boolean => {
        return config['retention::feature::enabled'] === true;
    },
    run: async (): Promise<RetentionTaskResult> => {
        return await postRetention('feature');
    },
}];
