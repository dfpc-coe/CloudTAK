import test from 'node:test';
import assert from 'node:assert';
import LayerMapControl from '../stateless/lib/control/LayerMap.js';
import { LayerMap_Type } from '../common/enums.js';

test('LayerMapControl.requiredScope: CoreFeature always requires feature:submit', () => {
    assert.equal(LayerMapControl.requiredScope(LayerMap_Type.COREFEATURE), 'feature:submit');
    assert.equal(LayerMapControl.requiredScope(LayerMap_Type.COREFEATURE, 'create'), 'feature:submit');
    assert.equal(LayerMapControl.requiredScope(LayerMap_Type.COREFEATURE, 'update'), 'feature:submit');
});

test('LayerMapControl.requiredScope: CoreEvent scopes by action', () => {
    assert.equal(LayerMapControl.requiredScope(LayerMap_Type.COREEVENT), 'event:create');
    assert.equal(LayerMapControl.requiredScope(LayerMap_Type.COREEVENT, 'create'), 'event:create');
    assert.equal(LayerMapControl.requiredScope(LayerMap_Type.COREEVENT, 'update'), 'event:update');
});

test('LayerMapControl.requiredScope: CoreDevice scopes by action', () => {
    assert.equal(LayerMapControl.requiredScope(LayerMap_Type.COREDEVICE), 'device:create');
    assert.equal(LayerMapControl.requiredScope(LayerMap_Type.COREDEVICE, 'create'), 'device:create');
    assert.equal(LayerMapControl.requiredScope(LayerMap_Type.COREDEVICE, 'update'), 'device:update');
});

test('LayerMapControl.hasMapScope: empty permissions deny everything', () => {
    for (const type of [LayerMap_Type.COREFEATURE, LayerMap_Type.COREEVENT, LayerMap_Type.COREDEVICE]) {
        assert.equal(LayerMapControl.hasMapScope([], type, 'create'), false);
        assert.equal(LayerMapControl.hasMapScope([], type, 'update'), false);
    }
});

test('LayerMapControl.hasMapScope: exact scope match', () => {
    assert.equal(LayerMapControl.hasMapScope(['feature:submit'], LayerMap_Type.COREFEATURE), true);
    assert.equal(LayerMapControl.hasMapScope(['event:create'], LayerMap_Type.COREEVENT, 'create'), true);
    assert.equal(LayerMapControl.hasMapScope(['event:update'], LayerMap_Type.COREEVENT, 'update'), true);
    assert.equal(LayerMapControl.hasMapScope(['device:create'], LayerMap_Type.COREDEVICE, 'create'), true);
    assert.equal(LayerMapControl.hasMapScope(['device:update'], LayerMap_Type.COREDEVICE, 'update'), true);
});

test('LayerMapControl.hasMapScope: create does not imply update', () => {
    assert.equal(LayerMapControl.hasMapScope(['event:create'], LayerMap_Type.COREEVENT, 'update'), false);
    assert.equal(LayerMapControl.hasMapScope(['device:create'], LayerMap_Type.COREDEVICE, 'update'), false);
});

test('LayerMapControl.hasMapScope: update does not imply create', () => {
    assert.equal(LayerMapControl.hasMapScope(['event:update'], LayerMap_Type.COREEVENT, 'create'), false);
    assert.equal(LayerMapControl.hasMapScope(['device:update'], LayerMap_Type.COREDEVICE, 'create'), false);
});

test('LayerMapControl.hasMapScope: wildcard level grants every action', () => {
    assert.equal(LayerMapControl.hasMapScope(['event:*'], LayerMap_Type.COREEVENT, 'create'), true);
    assert.equal(LayerMapControl.hasMapScope(['event:*'], LayerMap_Type.COREEVENT, 'update'), true);
    assert.equal(LayerMapControl.hasMapScope(['device:*'], LayerMap_Type.COREDEVICE, 'create'), true);
    assert.equal(LayerMapControl.hasMapScope(['device:*'], LayerMap_Type.COREDEVICE, 'update'), true);
    assert.equal(LayerMapControl.hasMapScope(['feature:*'], LayerMap_Type.COREFEATURE), true);
});

test('LayerMapControl.hasMapScope: scopes do not leak across resources', () => {
    assert.equal(LayerMapControl.hasMapScope(['event:*', 'event:create'], LayerMap_Type.COREDEVICE, 'create'), false);
    assert.equal(LayerMapControl.hasMapScope(['device:*'], LayerMap_Type.COREEVENT, 'create'), false);
    assert.equal(LayerMapControl.hasMapScope(['event:*', 'device:*'], LayerMap_Type.COREFEATURE), false);
});
