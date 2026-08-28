import test from 'node:test';
import assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { LayerStyle } from '../common/schema.js';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.connection();

test('Setup: Layer without Incoming config', async () => {
    const layer = await flight.config!.models.Layer.generate({
        name: 'Styled Layer',
        description: 'Layer for style tests',
        task: 'etl-test-v1.0.0',
        connection: 1,
    });

    assert.equal(layer.id, 1);
});

test('POST: api/connection/1/layer/1/incoming - with feature styles', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                cron: 'rate(1 minute)',
                styles: {
                    feature: {
                        enabled: true,
                        style: {
                            callsign: '{{name}}',
                            point: { 'marker-color': '#ff0000' },
                            queries: [{
                                query: 'metadata.type = "fire"',
                                styles: { point: { icon: 'fire' } },
                            }],
                        },
                    },
                },
            },
        }, true);

        assert.equal(res.body.layer, 1);
        assert.equal(res.body.enabled_styles, true);
        assert.deepEqual(res.body.styles, {
            feature: {
                enabled: true,
                style: {
                    callsign: '{{name}}',
                    point: { 'marker-color': '#ff0000', 'rotate': true },
                    queries: [{
                        query: 'metadata.type = "fire"',
                        styles: { point: { icon: 'fire', rotate: true } },
                    }],
                },
            },
        }, 'schema defaults are applied to stored styles');

        const rows = await flight.config!.models.LayerStyle.list({
            where: eq(LayerStyle.layer, 1),
        });

        assert.equal(rows.total, 1);
        assert.equal(rows.items[0].target, 'feature');
        assert.equal(rows.items[0].enabled, true);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/layer/1 - styles are keyed by target', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.incoming.enabled_styles, true);
        assert.equal(res.body.incoming.styles.feature.enabled, true);
        assert.equal(res.body.incoming.styles.feature.style.callsign, '{{name}}');
        assert.equal(res.body.incoming.styles.feature.style.queries.length, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/layer/1/incoming - invalid template rejected', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming', {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: {
                styles: {
                    feature: {
                        enabled: true,
                        style: { callsign: '{{#if}}' },
                    },
                },
            },
        }, false);

        assert.equal(res.status, 400);
        assert.match(res.body.message, /Invalid Callsign Template/);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/layer/1/incoming - update & disable feature styles', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming', {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: {
                styles: {
                    feature: {
                        enabled: false,
                        style: { remarks: 'Updated' },
                    },
                },
            },
        }, true);

        assert.equal(res.body.enabled_styles, false);
        assert.deepEqual(res.body.styles, {
            feature: {
                enabled: false,
                style: { remarks: 'Updated' },
            },
        });

        const rows = await flight.config!.models.LayerStyle.list({
            where: eq(LayerStyle.layer, 1),
        });

        assert.equal(rows.total, 1, 'upsert does not create duplicate rows');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/layer/1/incoming - omitting styles leaves them untouched', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming', {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: { config: { timezone: { timezone: 'UTC' } } },
        }, true);

        assert.deepEqual(res.body.config, { timezone: { timezone: 'UTC' } });
        assert.deepEqual(res.body.styles, {
            feature: {
                enabled: false,
                style: { remarks: 'Updated' },
            },
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('Layer without styles returns empty styles object', async () => {
    try {
        const layer = await flight.config!.models.Layer.generate({
            name: 'Unstyled Layer',
            description: 'Layer without styles',
            task: 'etl-test-v1.0.0',
            connection: 1,
        });

        await flight.config!.models.LayerIncoming.generate({ layer: layer.id });

        const res = await flight.fetch(`/api/connection/1/layer/${layer.id}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.incoming.enabled_styles, false);
        assert.deepEqual(res.body.incoming.styles, {});
    } catch (err) {
        assert.ifError(err);
    }
});

test('Deleting Incoming config cascades to layer_style', async () => {
    await flight.config!.models.LayerIncoming.delete(1);

    const rows = await flight.config!.models.LayerStyle.list({
        where: eq(LayerStyle.layer, 1),
    });

    assert.equal(rows.total, 0);
});

flight.landing();
