process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import Sinon from 'sinon';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';
import type { SubmitCotsRequest } from '../common/hub/index.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.integration('etl-test');
flight.connection();

const GUID = '6840f919-76f1-4f46-a61c-46055ff0ed30';

const feature = {
    id: 'caic-1',
    type: 'Feature',
    properties: {
        type: 'u-d-f',
        callsign: 'Front Range - Moderate',
    },
    geometry: {
        type: 'Polygon',
        coordinates: [[[-105.5, 40.0], [-105.4, 40.0], [-105.4, 40.1], [-105.5, 40.1], [-105.5, 40.0]]],
    },
};

async function postToDataSync(data: { name: string; mission_guid?: string }): Promise<SubmitCotsRequest> {
    const row = await flight.config!.models.Data.generate({
        name: data.name,
        mission_guid: data.mission_guid,
        mission_token: 'mission-token',
        mission_sync: true,
        mission_diff: false,
        connection: 1,
    });

    const layer = await flight.config!.models.Layer.generate({
        name: 'CAIC Layer',
        task: 1,
        version: '1.0.0',
        connection: 1,
    });

    await flight.config!.models.LayerIncoming.generate({
        layer: layer.id,
        data: row.id,
    });

    const statusStub = Sinon.stub(flight.config!.hub, 'connectionStatus').resolves({ 1: 'live' });
    const submitStub = Sinon.stub(flight.config!.hub, 'submitCots').resolves();

    try {
        const res = await flight.fetch(`/api/layer/${layer.id}/cot`, {
            method: 'POST',
            auth: {
                bearer: 'etl.' + jwt.sign({ access: 'layer', id: layer.id, internal: true }, 'coe-wildland-fire'),
            },
            body: {
                type: 'FeatureCollection',
                uids: ['caic-1'],
                features: [feature],
            },
        }, true);

        assert.equal(res.body.message, 'Submitted');
        assert.equal(submitStub.callCount, 1);

        return submitStub.firstCall.args[0];
    } finally {
        statusStub.restore();
        submitStub.restore();

        await flight.config!.models.LayerIncoming.delete(layer.id);
        await flight.config!.models.Layer.delete(layer.id);
        await flight.config!.models.Data.delete(row.id);
    }
}

test('POST: api/layer/:layerid/cot - Data Sync CoTs are addressed by Mission GUID', async () => {
    try {
        const submitted = await postToDataSync({ name: 'CAIC Avalanche Forecast ', mission_guid: GUID });

        assert.equal(submitted.connection, 1);
        assert.equal(submitted.cots.length, 1);

        const dest = submitted.cots[0].detail().marti?.dest;
        assert.ok(Array.isArray(dest));
        assert.deepEqual(dest, [{ _attributes: { 'mission-guid': GUID } }]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/layer/:layerid/cot - Data Sync without a GUID falls back to the trimmed Mission name', async () => {
    try {
        const submitted = await postToDataSync({ name: ' CAIC Avalanche Forecast ' });

        const dest = submitted.cots[0].detail().marti?.dest;
        assert.ok(Array.isArray(dest));
        assert.deepEqual(dest, [{ _attributes: { mission: 'CAIC Avalanche Forecast' } }]);
    } catch (err) {
        assert.ifError(err);
    }
});
