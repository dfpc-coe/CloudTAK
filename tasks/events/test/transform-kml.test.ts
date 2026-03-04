import test, { type TestContext } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import KML from '../src/transforms/kml.js';
import type { Message, LocalMessage } from '../src/types.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

// KML with a local placemark + a NetworkLink pointing to http://example.com/linked.kml
const ROOT_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>NetworkLink Test</name>
    <Placemark>
      <name>Local Feature</name>
      <Point><coordinates>-105.1,40.1,0</coordinates></Point>
    </Placemark>
    <NetworkLink>
      <name>Remote Features</name>
      <Link>
        <href>http://example.com/linked.kml</href>
      </Link>
    </NetworkLink>
  </Document>
</kml>`;

// KML returned by the mocked remote endpoint
const LINKED_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Linked Document</name>
    <Placemark>
      <name>Remote Feature</name>
      <Point><coordinates>-105.2,40.2,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`;

// Helper to build a minimal Message / LocalMessage pointing at a temp .kml file.
// Registers an after-hook on the provided test context to remove the tmpdir on completion.
async function makeTransform(t: TestContext, content: string): Promise<{ transform: KML; tmpdir: string }> {
    const tmpdir = await fs.mkdtemp('/tmp/kml-test-');

    t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

    const raw = path.join(tmpdir, 'test.kml');
    await fs.writeFile(raw, content);

    const transform = new KML(
        {} as Message,
        {
            tmpdir,
            name: 'test.kml',
            ext: '.kml',
            id: 'test',
            raw
        } as LocalMessage
    );

    return { transform, tmpdir };
}

test('KML Transform — NetworkLink', async (t) => {
    await t.test('linked features are fetched and merged; NetworkLink itself is excluded', async (st) => {
        const mockAgent = new MockAgent();
        const originalDispatcher = getGlobalDispatcher();
        mockAgent.disableNetConnect();
        setGlobalDispatcher(mockAgent);

        st.after(() => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        });

        mockAgent
            .get('http://example.com')
            .intercept({ path: '/linked.kml', method: 'GET' })
            .reply(200, LINKED_KML, { headers: { 'content-type': 'application/vnd.google-earth.kml+xml' } });

        const { transform } = await makeTransform(t, ROOT_KML);
        const result = await transform.convert();

        const lines = (await fs.readFile(result.asset, 'utf8')).trim().split('\n').filter(Boolean);
        const features = lines.map((l) => JSON.parse(l));

        assert.strictEqual(features.length, 2, 'should have 2 features (1 local + 1 linked)');

        const names = features.map((f) => f.properties?.name);
        assert.ok(names.includes('Local Feature'), 'local feature present');
        assert.ok(names.includes('Remote Feature'), 'linked feature present');

        const hasNetworkLink = features.some((f) => f.properties?.['@geometry-type'] === 'networklink');
        assert.ok(!hasNetworkLink, 'NetworkLink meta feature must not appear in output');
    });

    await t.test('duplicate NetworkLink href is only fetched once', async (st) => {
        const dupKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <NetworkLink>
      <Link><href>http://example.com/linked.kml</href></Link>
    </NetworkLink>
    <NetworkLink>
      <Link><href>http://example.com/linked.kml</href></Link>
    </NetworkLink>
  </Document>
</kml>`;

        const mockAgent = new MockAgent();
        const originalDispatcher = getGlobalDispatcher();
        mockAgent.disableNetConnect();
        setGlobalDispatcher(mockAgent);

        st.after(() => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        });

        let fetchCount = 0;
        mockAgent
            .get('http://example.com')
            .intercept({ path: '/linked.kml', method: 'GET' })
            .reply(() => {
                fetchCount++;
                return { statusCode: 200, data: LINKED_KML };
            })
            .persist();

        const { transform } = await makeTransform(t, dupKml);
        await transform.convert();

        assert.strictEqual(fetchCount, 1, 'duplicate href should only be fetched once');
    });

    await t.test('depth cap is enforced — deep chains are truncated at MAX_NETWORK_LINK_DEPTH', async (st) => {
        // Depth-0 KML links to depth-1 which links to depth-2, etc.
        // MAX_NETWORK_LINK_DEPTH is 3, so depth-3 link must be skipped.
        const makeDepthKml = (nextHref: string | null) => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>depth-feature</name>
      <Point><coordinates>0,0,0</coordinates></Point>
    </Placemark>
    ${nextHref ? `<NetworkLink><Link><href>${nextHref}</href></Link></NetworkLink>` : ''}
  </Document>
</kml>`;

        const mockAgent = new MockAgent();
        const originalDispatcher = getGlobalDispatcher();
        mockAgent.disableNetConnect();
        setGlobalDispatcher(mockAgent);

        st.after(() => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        });

        const pool = mockAgent.get('http://example.com');

        // depth 1 → links to depth 2
        pool.intercept({ path: '/depth1.kml', method: 'GET' })
            .reply(200, makeDepthKml('http://example.com/depth2.kml'));
        // depth 2 → links to depth 3
        pool.intercept({ path: '/depth2.kml', method: 'GET' })
            .reply(200, makeDepthKml('http://example.com/depth3.kml'));
        // depth 3 → links to depth 4 (should be blocked by cap)
        pool.intercept({ path: '/depth3.kml', method: 'GET' })
            .reply(200, makeDepthKml('http://example.com/depth4.kml'));
        // depth 4 must never be fetched
        pool.intercept({ path: '/depth4.kml', method: 'GET' })
            .reply(200, makeDepthKml(null));

        const rootKml = makeDepthKml('http://example.com/depth1.kml');
        const { transform } = await makeTransform(t, rootKml);
        const result = await transform.convert();

        const lines = (await fs.readFile(result.asset, 'utf8')).trim().split('\n').filter(Boolean);
        // Root (depth 0) + depth1 + depth2 + depth3 = 4 features; depth4 must not appear
        assert.strictEqual(lines.length, 4, 'should have 4 features (depths 0-3), depth 4 truncated');
    });

    await t.test('SSRF — localhost is blocked', async (st) => {
        const mockAgent = new MockAgent();
        const originalDispatcher = getGlobalDispatcher();
        mockAgent.disableNetConnect();
        setGlobalDispatcher(mockAgent);
        st.after(() => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        });

        const ssrfKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <NetworkLink>
      <Link><href>http://localhost/secret</href></Link>
    </NetworkLink>
  </Document>
</kml>`;

        const { transform } = await makeTransform(st, ssrfKml);
        // Should complete without throwing — SSRF URL is silently skipped
        const result = await transform.convert();
        const lines = (await fs.readFile(result.asset, 'utf8')).trim().split('\n').filter(Boolean);
        assert.strictEqual(lines.length, 0, 'no features — SSRF link must be blocked and skipped');
    });

    await t.test('SSRF — private IP range 10.x.x.x is blocked', async (st) => {
        const mockAgent = new MockAgent();
        const originalDispatcher = getGlobalDispatcher();
        mockAgent.disableNetConnect();
        setGlobalDispatcher(mockAgent);
        st.after(() => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        });

        const ssrfKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <NetworkLink>
      <Link><href>http://10.0.0.1/internal</href></Link>
    </NetworkLink>
  </Document>
</kml>`;

        const { transform } = await makeTransform(st, ssrfKml);
        const result = await transform.convert();
        const lines = (await fs.readFile(result.asset, 'utf8')).trim().split('\n').filter(Boolean);
        assert.strictEqual(lines.length, 0, 'no features — private IP link must be blocked');
    });

    await t.test('SSRF — non-http scheme (file://) is blocked', async (st) => {
        const mockAgent = new MockAgent();
        const originalDispatcher = getGlobalDispatcher();
        mockAgent.disableNetConnect();
        setGlobalDispatcher(mockAgent);
        st.after(() => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        });

        const ssrfKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <NetworkLink>
      <Link><href>file:///etc/passwd</href></Link>
    </NetworkLink>
  </Document>
</kml>`;

        const { transform } = await makeTransform(st, ssrfKml);
        const result = await transform.convert();
        const lines = (await fs.readFile(result.asset, 'utf8')).trim().split('\n').filter(Boolean);
        assert.strictEqual(lines.length, 0, 'no features — file:// scheme must be blocked');
    });

    await t.test('relative href is resolved against base URL', async (st) => {
        const relativeKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <NetworkLink>
      <Link><href>http://example.com/linked.kml</href></Link>
    </NetworkLink>
  </Document>
</kml>`;

        // Simulates a relative href by having the linked KML itself contain a relative link
        const linkedWithRelative = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Linked Feature</name>
      <Point><coordinates>1,1,0</coordinates></Point>
    </Placemark>
    <NetworkLink>
      <Link><href>sibling.kml</href></Link>
    </NetworkLink>
  </Document>
</kml>`;

        const siblingKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Sibling Feature</name>
      <Point><coordinates>2,2,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`;

        const mockAgent = new MockAgent();
        const originalDispatcher = getGlobalDispatcher();
        mockAgent.disableNetConnect();
        setGlobalDispatcher(mockAgent);

        st.after(() => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        });

        const pool = mockAgent.get('http://example.com');
        pool.intercept({ path: '/linked.kml', method: 'GET' }).reply(200, linkedWithRelative);
        pool.intercept({ path: '/sibling.kml', method: 'GET' }).reply(200, siblingKml);

        const { transform } = await makeTransform(t, relativeKml);
        const result = await transform.convert();

        const lines = (await fs.readFile(result.asset, 'utf8')).trim().split('\n').filter(Boolean);
        const names = lines.map((l) => JSON.parse(l).properties?.name);
        assert.ok(names.includes('Linked Feature'), 'linked feature present');
        assert.ok(names.includes('Sibling Feature'), 'sibling feature resolved from relative href');
    });

    await t.test('HTTP relative href resolving to a different origin is blocked', async (st) => {
        // //other.com/path resolves to http://other.com/path against http://example.com/...
        const linkedWithCrossOrigin = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Linked Feature</name>
      <Point><coordinates>1,1,0</coordinates></Point>
    </Placemark>
    <NetworkLink>
      <Link><href>//other.com/cross-origin.kml</href></Link>
    </NetworkLink>
  </Document>
</kml>`;

        const crossOriginKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Cross-Origin Feature</name>
      <Point><coordinates>9,9,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`;

        const relativeKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <NetworkLink>
      <Link><href>http://example.com/linked.kml</href></Link>
    </NetworkLink>
  </Document>
</kml>`;

        const mockAgent = new MockAgent();
        const originalDispatcher = getGlobalDispatcher();
        mockAgent.disableNetConnect();
        setGlobalDispatcher(mockAgent);

        st.after(() => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        });

        mockAgent.get('http://example.com')
            .intercept({ path: '/linked.kml', method: 'GET' })
            .reply(200, linkedWithCrossOrigin);

        // If cross-origin fetch were attempted it would throw (disableNetConnect),
        // causing the test to fail. We also verify no cross-origin features appear.
        mockAgent.get('http://other.com')
            .intercept({ path: '/cross-origin.kml', method: 'GET' })
            .reply(200, crossOriginKml);

        const { transform } = await makeTransform(t, relativeKml);
        const result = await transform.convert();

        const lines = (await fs.readFile(result.asset, 'utf8')).trim().split('\n').filter(Boolean);
        const names = lines.map((l) => JSON.parse(l).properties?.name);
        assert.ok(names.includes('Linked Feature'), 'same-origin linked feature is included');
        assert.ok(!names.includes('Cross-Origin Feature'), 'cross-origin feature must be blocked');
    });

    await t.test('local relative NetworkLink within tmpdir is resolved', async (st) => {
        const mockAgent = new MockAgent();
        const originalDispatcher = getGlobalDispatcher();
        mockAgent.disableNetConnect();
        setGlobalDispatcher(mockAgent);
        st.after(() => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        });

        const rootKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Root Feature</name>
      <Point><coordinates>0,0,0</coordinates></Point>
    </Placemark>
    <NetworkLink>
      <Link><href>sub/linked.kml</href></Link>
    </NetworkLink>
  </Document>
</kml>`;

        const linkedKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Sub Feature</name>
      <Point><coordinates>1,1,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`;

        const { transform, tmpdir } = await makeTransform(st, rootKml);
        // Place the linked KML inside tmpdir/sub/ to simulate a multi-file KMZ extraction
        await fs.mkdir(path.join(tmpdir, 'sub'), { recursive: true });
        await fs.writeFile(path.join(tmpdir, 'sub', 'linked.kml'), linkedKml);

        const result = await transform.convert();

        const lines = (await fs.readFile(result.asset, 'utf8')).trim().split('\n').filter(Boolean);
        const names = lines.map((l) => JSON.parse(l).properties?.name);
        assert.ok(names.includes('Root Feature'), 'root feature present');
        assert.ok(names.includes('Sub Feature'), 'local relative linked feature present');
    });

    await t.test('local relative NetworkLink path traversal outside tmpdir is blocked', async (st) => {
        const mockAgent = new MockAgent();
        const originalDispatcher = getGlobalDispatcher();
        mockAgent.disableNetConnect();
        setGlobalDispatcher(mockAgent);
        st.after(() => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        });

        const traversalKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <NetworkLink>
      <Link><href>../../../etc/passwd</href></Link>
    </NetworkLink>
  </Document>
</kml>`;

        const { transform } = await makeTransform(st, traversalKml);
        const result = await transform.convert();

        const lines = (await fs.readFile(result.asset, 'utf8')).trim().split('\n').filter(Boolean);
        assert.strictEqual(lines.length, 0, 'no features — path traversal outside tmpdir must be blocked');
    });

    await t.test('NetworkLink URL that returns a KMZ is unpacked and features extracted', async (st) => {
        // Google Maps d/kml URLs return application/vnd.google-earth.kmz — a ZIP that
        // contains both doc.kml AND any icon assets bundled in the archive.
        const kmzBytes = await fs.readFile(new URL('./fixtures/networklink-linked.kmz', import.meta.url));

        const rootKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <NetworkLink>
      <Link><href>http://example.com/linked.kmz</href></Link>
    </NetworkLink>
  </Document>
</kml>`;

        const mockAgent = new MockAgent();
        const originalDispatcher = getGlobalDispatcher();
        mockAgent.disableNetConnect();
        setGlobalDispatcher(mockAgent);

        st.after(() => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        });

        mockAgent
            .get('http://example.com')
            .intercept({ path: '/linked.kmz', method: 'GET' })
            .reply(200, kmzBytes, { headers: { 'content-type': 'application/vnd.google-earth.kmz' } });

        const { transform } = await makeTransform(t, rootKml);
        const result = await transform.convert();

        const lines = (await fs.readFile(result.asset, 'utf8')).trim().split('\n').filter(Boolean);
        const features = lines.map((l) => JSON.parse(l));

        // The KMZ fixture has one Placemark with an embedded icon.png.
        // If the icon was NOT extracted, the feature would be silently dropped.
        assert.strictEqual(features.length, 1, 'should have 1 feature extracted from linked KMZ (dropped = icon not found)');
        assert.strictEqual(features[0].properties?.name, 'KMZ Feature', 'feature from KMZ doc.kml is present');

        // The bundled icon must be present in the convert result icons set.
        assert.ok(result.icons && result.icons.size > 0, 'icon set from linked KMZ must not be empty');
        const iconNames = result.icons ? [...result.icons].map((i) => i.name) : [];
        assert.ok(iconNames.some((n) => n.endsWith('.png')), `icon.png from linked KMZ must be in result icons (got: ${iconNames.join(', ')})`);
    });
});
