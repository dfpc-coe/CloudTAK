import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: /api/iconset', async () => {
    try {
        const res = await flight.fetch('/api/iconset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: /api/iconset', async () => {
    try {
        const res = await flight.fetch('/api/iconset', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                uid: 'test-iconset',
                version: 1,
                name: 'Test Iconset',
                default_group: 'test',
                default_friendly: 'test',
                default_hostile: 'test',
                default_neutral: 'test',
                default_unknown: 'test'
            }
        }, true);

        assert.equal(res.body.uid, 'test-iconset');
        assert.equal(res.body.version, 1);
        assert.equal(res.body.name, 'Test Iconset');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: /api/iconset/:iconset/icon - PNG with folder', async () => {
    try {
        const res = await flight.fetch('/api/iconset/test-iconset/icon', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'google/camera.png',
                data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            }
        }, true);

        assert.equal(res.body.name, 'google/camera');
        assert.equal(res.body.path, 'test-iconset/google/camera');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: /api/iconset/:iconset/icon - PNG without folder', async () => {
    try {
        const res = await flight.fetch('/api/iconset/test-iconset/icon', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'car.png',
                data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            }
        }, true);

        assert.equal(res.body.name, 'car');
        assert.equal(res.body.path, 'test-iconset/car');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: /api/iconset/:iconset/icon - SVG with folder', async () => {
    try {
        const res = await flight.fetch('/api/iconset/test-iconset/icon', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'google/camera.svg',
                data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InJlZCIvPjwvc3ZnPg=='
            }
        }, true);

        assert.equal(res.body.name, 'google/camera');
        assert.equal(res.body.path, 'test-iconset/google/camera');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: /api/iconset/:iconset/icon - SVG without folder', async () => {
    try {
        const res = await flight.fetch('/api/iconset/test-iconset/icon', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'car.svg',
                data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InJlZCIvPjwvc3ZnPg=='
            }
        }, true);

        assert.equal(res.body.name, 'car');
        assert.equal(res.body.path, 'test-iconset/car');

        // Allow time for background sprite generation to complete before test teardown
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /api/icon', async () => {
    try {
        const res = await flight.fetch('/api/icon?iconset=test-iconset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.total, 4);
        assert.equal(res.body.items.length, 4);

        const cameraPng = res.body.items.find((i: any) => i.name === 'google/camera' && i.format === '.png');
        assert.ok(cameraPng);
        assert.equal(cameraPng.path, 'test-iconset/google/camera');

        const carPng = res.body.items.find((i: any) => i.name === 'car' && i.format === '.png');
        assert.ok(carPng);
        assert.equal(carPng.path, 'test-iconset/car');

        const cameraSvg = res.body.items.find((i: any) => i.name === 'google/camera' && i.format === '.svg');
        assert.ok(cameraSvg);
        assert.equal(cameraSvg.path, 'test-iconset/google/camera');

        const carSvg = res.body.items.find((i: any) => i.name === 'car' && i.format === '.svg');
        assert.ok(carSvg);
        assert.equal(carSvg.path, 'test-iconset/car');

    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /api/iconset/:iconset/icon/:icon', async () => {
    try {
        // List icons to get IDs
        const list = await flight.fetch('/api/icon?iconset=test-iconset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        for (const icon of list.body.items) {
            const res = await flight.fetch(`/api/iconset/test-iconset/icon/${icon.id}`, {
                method: 'GET',
                auth: {
                    bearer: flight.token.admin
                }
            }, true);

            assert.equal(res.body.id, icon.id);
            assert.equal(res.body.name, icon.name);
            assert.equal(res.body.path, icon.path);
            assert.equal(res.body.iconset, 'test-iconset');
        }

    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /api/iconset/:iconset/icon/:name', async () => {
    try {
        // Delete SVGs to avoid path collision for name lookup test
        const listAll = await flight.fetch('/api/icon?iconset=test-iconset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        for (const icon of listAll.body.items) {
            if (icon.format === '.svg') {
                await flight.fetch(`/api/iconset/test-iconset/icon/${icon.id}`, {
                    method: 'DELETE',
                    auth: {
                        bearer: flight.token.admin
                    }
                }, false);
            }
        }

        const list = await flight.fetch('/api/icon?iconset=test-iconset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        for (const icon of list.body.items) {
            const relativePath = icon.path.replace(`${icon.iconset}/`, '');
            const nameWithExt = `${relativePath}${icon.format}`;
            const encodedName = encodeURIComponent(nameWithExt);

            const res = await flight.fetch(`/api/iconset/test-iconset/icon/${encodedName}`, {
                method: 'GET',
                auth: {
                    bearer: flight.token.admin
                }
            }, true);

            assert.equal(res.body.id, icon.id);
            assert.equal(res.body.name, icon.name);
        }
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
