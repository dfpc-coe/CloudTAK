import type { Message } from './types.ts';
import jwt from 'jsonwebtoken';

export async function createImportResult(
    msg: Message,
    result: {
        name: string;
        type: 'Feature' | 'Asset' | 'Iconset' | 'Basemap';
        type_id: string;
    }
) {
    // Only imports have the create result endpoint - if we are running the task for something else
    // we can ignore this call
    if (!msg.job || !msg.job.id) return;

    try {
        const res = await fetch(new URL(`/api/import/${msg.job.id}/result`, msg.api), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt.sign({ access: 'user', email: msg.job.username }, msg.secret)}`,
            },
            body: JSON.stringify(result)
        });

        if (!res.ok) {
            console.error(`Failed to create import result: ${await res.text()}`);
        }
    } catch (err) {
        console.error('Failed to create import result:', err);
    }
}
