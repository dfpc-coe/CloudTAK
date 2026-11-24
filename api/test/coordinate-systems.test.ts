import test from 'node:test';
import assert from 'node:assert';
import proj4 from 'proj4';
import {
    parseCoordinateSystems,
    coordinateSystems,
    coordinateModes,
    isCoordinateMode,
    resetCoordinateSystems,
} from '../common/coordinate-systems.js';

const bounds = { minLongitude: 160.6, minLatitude: -55.95, maxLongitude: -171.2, maxLatitude: -25.88 };

test('Coordinate Systems: bundled file offers NZTM', () => {
    resetCoordinateSystems();
    const systems = coordinateSystems();

    assert.deepEqual(systems.map((crs) => crs.name), ['NZTM']);
    assert.equal(systems[0].title, 'New Zealand Transverse Mercator');
    assert.equal(systems[0].epsg, 2193);
    assert.ok(systems[0].proj4.includes('+proj=tmerc'));
    assert.deepEqual(coordinateModes(), ['dd', 'dm', 'dms', 'mgrs', 'utm', 'NZTM']);
    assert.ok(isCoordinateMode('NZTM'));
    assert.ok(isCoordinateMode('dd'));
    assert.ok(!isCoordinateMode('BNG'));
});

test('Coordinate Systems: NZTM definition matches EPSG:2193', () => {
    const [crs] = parseCoordinateSystems(JSON.stringify({ crs: [{ name: 'NZTM', title: 'NZTM', epsg: 2193, bounds }] }));

    // The true origin of NZTM is lat 0, lon 173 at E 1600000, N 10000000
    const [east, north] = proj4('EPSG:4326', crs.proj4).forward([173, 0]);
    assert.ok(Math.abs(east - 1600000) < 0.001);
    assert.ok(Math.abs(north - 10000000) < 0.001);
});

test('Coordinate Systems: explicit proj4 definition takes precedence over epsg', () => {
    const def = '+proj=tmerc +lat_0=0 +lon_0=177 +k=0.9996 +x_0=500000 +y_0=10000000 +ellps=WGS84 +units=m +no_defs';
    const [crs] = parseCoordinateSystems(JSON.stringify({ crs: [{ name: 'Custom', title: 'Custom', epsg: 2193, proj4: def, bounds }] }));
    assert.equal(crs.proj4, def);
});

test('Coordinate Systems: invalid entries are skipped, valid ones kept', () => {
    const errors: Array<string> = [];
    const original = console.error;
    console.error = (message: string) => { errors.push(message); };

    try {
        const systems = parseCoordinateSystems(JSON.stringify({
            crs: [
                { name: 'NZTM', title: 'NZTM', epsg: 2193, bounds },
                { name: 'nztm', title: 'Duplicate', epsg: 2193, bounds },
                { name: 'UTM', title: 'Clashes with built-in', epsg: 2193, bounds },
                { name: 'Unknown', title: 'No definition', epsg: 1, bounds },
                { name: 'Broken', title: 'Bad definition', proj4: '+proj=nonsense', bounds },
            ],
        }));

        assert.deepEqual(systems.map((crs) => crs.name), ['NZTM']);
        assert.equal(errors.length, 4);
    } finally {
        console.error = original;
    }
});

test('Coordinate Systems: malformed file is rejected', () => {
    assert.throws(() => parseCoordinateSystems('{ "crs": "nope" }'));
    assert.throws(() => parseCoordinateSystems('not json'));
});

test('Coordinate Systems: unreadable file falls back to built-in modes only', () => {
    const original = console.error;
    console.error = () => undefined;
    process.env.CLOUDTAK_COORDINATE_SYSTEMS_FILE = '/does/not/exist.json';
    resetCoordinateSystems();

    try {
        assert.deepEqual(coordinateSystems(), []);
        assert.deepEqual(coordinateModes(), ['dd', 'dm', 'dms', 'mgrs', 'utm']);
    } finally {
        console.error = original;
        delete process.env.CLOUDTAK_COORDINATE_SYSTEMS_FILE;
        resetCoordinateSystems();
    }
});
