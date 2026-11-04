import { describe, it, expect, vi } from 'vitest';
import AtlasDatabase from '../workers/atlas-database.ts';
import { WorkerMessageType } from '../utils/events.ts';
import type Atlas from '../workers/atlas.ts';
import type { Feature } from '../types.ts';

const GUID = '9ba05e1d-970f-49e1-a153-7216fecf5279';

function setup() {
    const postMessage = vi.fn(async () => undefined);
    const atlas = { postMessage } as unknown as Atlas;
    return { db: new AtlasDatabase(atlas), postMessage };
}

function task(type: string, missionChanges: unknown[]): Feature {
    return {
        id: 'task-1',
        type: 'Feature',
        path: '/',
        properties: {
            id: 'task-1',
            type,
            how: 'h-g-i-g-o',
            callsign: 'UNKNOWN',
            center: [0, 0, 0],
            mission: {
                type: 'CHANGE',
                tool: 'public',
                name: 'kv-test',
                guid: GUID,
                authorUid: 'test-plugin',
                missionChanges
            }
        },
        geometry: { type: 'Point', coordinates: [0, 0, 0] }
    } as unknown as Feature;
}

const change = (type: string, missionProperty?: { key: string, value: string }) => ({
    creatorUid: 'test-plugin',
    isFederatedChange: false,
    missionName: 'kv-test',
    timestamp: '2026-09-28T04:28:57.127Z',
    type,
    ...(missionProperty ? { missionProperty } : {})
});

describe('AtlasDatabase t-x-m-c-p Mission Property changes', () => {
    it('broadcasts a property set', async () => {
        const { db, postMessage } = setup();
        await db.subChange(task('t-x-m-c-p', [change('ADD_CONTENT', { key: 'test.live', value: '3' })]));

        expect(postMessage).toHaveBeenCalledWith({
            type: WorkerMessageType.Mission_Change_Property,
            body: {
                guid: GUID,
                name: 'kv-test',
                changes: [{
                    type: 'ADD_CONTENT',
                    key: 'test.live',
                    value: '3',
                    creatorUid: 'test-plugin',
                    timestamp: '2026-09-28T04:28:57.127Z'
                }]
            }
        });
    });

    it('broadcasts a property removal', async () => {
        const { db, postMessage } = setup();
        await db.subChange(task('t-x-m-c-p', [change('REMOVE_CONTENT', { key: 'test.live', value: '3' })]));

        const body = (postMessage.mock.calls[0] as unknown[])[0] as { body: { changes: Array<{ type: string }> } };
        expect(body.body.changes[0].type).toBe('REMOVE_CONTENT');
    });

    it('still signals listeners when the CoT carried no MissionProperty', async () => {
        const { db, postMessage } = setup();
        await db.subChange(task('t-x-m-c-p', [change('ADD_CONTENT')]));

        expect(postMessage).toHaveBeenCalledWith({
            type: WorkerMessageType.Mission_Change_Property,
            body: { guid: GUID, name: 'kv-test', changes: [] }
        });
    });

    it('does not treat a property change as mission content', async () => {
        const { db, postMessage } = setup();
        await db.subChange(task('t-x-m-c-p', [change('ADD_CONTENT', { key: 'test.live', value: '3' })]));

        expect(db.subscriptionPending.size).toBe(0);
        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: WorkerMessageType.Mission_Change_Feature }));
    });
});
