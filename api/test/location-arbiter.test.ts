import test from 'node:test';
import assert from 'node:assert';
import LocationArbiter, { sourceOf } from '../stateful/lib/location-arbiter.js';
import type { Fix } from '../stateful/lib/location-arbiter.js';

function setup() {
    const clock = { t: 1_000_000 };
    const arbiter = new LocationArbiter({ now: () => clock.t });
    const advance = (ms: number) => { clock.t += ms; };
    return { arbiter, advance };
}

const U = 'user@example.com';
const gps = (session: string, accuracy: number, channel: Fix['channel'] = 'ws'): Fix => ({ session, source: 'gps', accuracy, channel });
const manual = (session: string, channel: Fix['channel'] = 'ws'): Fix => ({ session, source: 'manual', channel });

test('LocationArbiter: a lone session is always accepted', () => {
    const { arbiter, advance } = setup();
    for (let i = 0; i < 5; i++) {
        assert.equal(arbiter.decide(U, gps('a', 8)).accept, true);
        advance(5000);
    }
    assert.deepEqual(arbiter.state(U, 'a'), { active: true });
});

test('LocationArbiter: 0,0 is forwarded to register the connection but never becomes the broadcaster', () => {
    const { arbiter } = setup();
    const none: Fix = { session: 'a', source: 'none', channel: 'ws' };
    assert.equal(arbiter.decide(U, none).accept, true);
    assert.deepEqual(arbiter.state(U, 'b'), { active: true });
    assert.equal(arbiter.decide(U, gps('b', 20)).accept, true);
    assert.equal(arbiter.decide(U, none).accept, false);
});

test('LocationArbiter: 0,0 is forwarded again once the broadcaster goes quiet', () => {
    const { arbiter, advance } = setup();
    const none: Fix = { session: 'a', source: 'none', channel: 'ws' };
    assert.equal(arbiter.decide(U, gps('b', 20)).accept, true);
    assert.equal(arbiter.decide(U, none).accept, false);
    advance(60_000);
    assert.equal(arbiter.decide(U, none).accept, true);
});

test('LocationArbiter: a broadcaster that loses its position gives up the role', () => {
    const { arbiter, advance } = setup();
    assert.equal(arbiter.decide(U, gps('a', 8)).accept, true);
    advance(1000);
    assert.equal(arbiter.decide(U, gps('b', 10)).accept, false);
    advance(1000);
    assert.equal(arbiter.decide(U, { session: 'a', source: 'none', channel: 'ws' }).accept, true);
    advance(1000);
    assert.equal(arbiter.decide(U, gps('b', 10)).accept, true);
    assert.deepEqual(arbiter.state(U, 'b'), { active: true });
});

test('LocationArbiter: a fix without a session is accepted', () => {
    const { arbiter } = setup();
    assert.equal(arbiter.decide(U, { source: 'gps', accuracy: 5, channel: 'ws' }).accept, true);
    assert.equal(arbiter.decide(U, { source: 'none', channel: 'ws' }).accept, true);
});

test('LocationArbiter: a second session with a similar fix stays on standby', () => {
    const { arbiter, advance } = setup();
    assert.equal(arbiter.decide(U, gps('phone', 8)).accept, true);
    advance(1000);
    const laptop = arbiter.decide(U, gps('laptop', 12));
    assert.equal(laptop.accept, false);
    assert.deepEqual(arbiter.state(U, 'laptop').active, false);
    assert.equal(arbiter.decide(U, gps('phone', 9)).accept, true);
});

test('LocationArbiter: standby sessions are told who is broadcasting', () => {
    const { arbiter, advance } = setup();
    arbiter.label(U, 'phone', 'Pixel 8 (app)');
    arbiter.decide(U, gps('phone', 8));
    advance(1000);
    arbiter.decide(U, manual('laptop'));
    assert.deepEqual(arbiter.state(U, 'laptop'), { active: false, by: 'Pixel 8 (app)' });
    assert.deepEqual(arbiter.state(U, 'phone'), { active: true });
});

test('LocationArbiter: live GPS replaces a manual location', () => {
    const { arbiter, advance } = setup();
    assert.equal(arbiter.decide(U, manual('desk')).accept, true);
    advance(1000);
    const res = arbiter.decide(U, gps('phone', 30));
    assert.equal(res.accept, true);
    assert.equal(res.changed, true);
    advance(1000);
    assert.equal(arbiter.decide(U, manual('desk')).accept, false);
});

test('LocationArbiter: a manual location never replaces live GPS', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('phone', 8));
    advance(1000);
    assert.equal(arbiter.decide(U, manual('desk')).accept, false);
});

test('LocationArbiter: only a clearly better GPS fix displaces a healthy broadcaster', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('laptop', 400));
    advance(1000);
    // Better, but not by the margin
    assert.equal(arbiter.decide(U, gps('phone', 200)).accept, false);
    advance(1000);
    // 3x and at least 50 m better
    const res = arbiter.decide(U, gps('phone', 8));
    assert.equal(res.accept, true);
    assert.equal(res.changed, true);
    advance(1000);
    // The laptop's accuracy improving does not take the role back
    assert.equal(arbiter.decide(U, gps('laptop', 300)).accept, false);
});

test('LocationArbiter: a small absolute improvement is not clearly better', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('a', 30));
    advance(1000);
    // 3x better but only 20 m better
    assert.equal(arbiter.decide(U, gps('b', 10)).accept, false);
});

test('LocationArbiter: a broadcaster that goes quiet is replaced by the best fresh session', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('laptop', 8));
    advance(1000);
    assert.equal(arbiter.decide(U, gps('phone', 10)).accept, false);
    advance(20_000);
    const res = arbiter.decide(U, gps('phone', 10));
    assert.equal(res.accept, true);
    assert.equal(res.changed, true);
    assert.deepEqual(arbiter.state(U, 'laptop'), { active: false, by: undefined });
});

test('LocationArbiter: after a broadcaster goes quiet, GPS wins over a manual location', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('laptop', 8));
    advance(1000);
    arbiter.decide(U, manual('desk'));
    arbiter.decide(U, gps('phone', 40));
    advance(20_000);
    // desk and phone are both fresh only if they keep reporting
    arbiter.decide(U, manual('desk'));
    assert.equal(arbiter.decide(U, gps('phone', 40)).accept, true);
});

test('LocationArbiter: a slow reporting rate is not mistaken for silence', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('slow', 8));
    advance(60_000);
    arbiter.decide(U, gps('slow', 8));
    advance(60_000);
    // 60 s between fixes: another session must not take over 70 s after the last one
    advance(10_000);
    assert.equal(arbiter.decide(U, gps('other', 8)).accept, false);
});

test('LocationArbiter: Take over waits for the claiming session\'s next fix', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('phone', 8));
    advance(1000);
    arbiter.claim(U, 'laptop');
    // The phone keeps the role until the laptop actually has a position
    assert.equal(arbiter.decide(U, gps('phone', 8)).accept, true);
    advance(1000);
    const res = arbiter.decide(U, manual('laptop'));
    assert.equal(res.accept, true);
    assert.equal(res.changed, true);
    advance(1000);
    assert.equal(arbiter.decide(U, gps('phone', 3)).accept, false);
});

test('LocationArbiter: a claimed broadcaster is not displaced by a better fix', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('phone', 8));
    advance(1000);
    arbiter.claim(U, 'laptop');
    arbiter.decide(U, manual('laptop'));
    advance(1000);
    assert.equal(arbiter.decide(U, gps('phone', 2)).accept, false);
});

test('LocationArbiter: a claimed broadcaster that goes quiet gives the role up', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('phone', 8));
    arbiter.claim(U, 'laptop');
    advance(1000);
    arbiter.decide(U, manual('laptop'));
    advance(20_000);
    assert.equal(arbiter.decide(U, gps('phone', 8)).accept, true);
});

test('LocationArbiter: a Take over that is never followed by a fix expires', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('phone', 8));
    arbiter.claim(U, 'laptop');
    advance(120_000);
    arbiter.decide(U, gps('phone', 8));
    advance(1000);
    // The stale claim must not hand the role over now
    assert.equal(arbiter.decide(U, manual('laptop')).accept, false);
});

test('LocationArbiter: native POSTs are ignored while the WebSocket reports, and used when it is silent', () => {
    const { arbiter, advance } = setup();
    assert.equal(arbiter.decide(U, gps('phone', 8, 'ws')).accept, true);
    advance(2000);
    const dup = arbiter.decide(U, gps('phone', 8, 'post'));
    assert.equal(dup.accept, false);
    assert.equal(dup.reason, 'duplicate of websocket fix');
    // The WebView is suspended: only POSTs arrive
    advance(20_000);
    assert.equal(arbiter.decide(U, gps('phone', 8, 'post')).accept, true);
});

test('LocationArbiter: a suppressed POST still shows the session is alive', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('phone', 8, 'ws'));
    for (let i = 0; i < 6; i++) {
        advance(4000);
        arbiter.decide(U, gps('phone', 8, 'post'));
    }
    // 24 s since the last WebSocket fix, but POSTs kept coming
    assert.equal(arbiter.decide(U, gps('laptop', 8)).accept, false);
});

test('LocationArbiter: users are independent', () => {
    const { arbiter } = setup();
    assert.equal(arbiter.decide('a@example.com', gps('s1', 8)).accept, true);
    assert.equal(arbiter.decide('b@example.com', gps('s2', 8)).accept, true);
});

test('LocationArbiter: forgets sessions that have been silent for a long time', () => {
    const { arbiter, advance } = setup();
    arbiter.decide(U, gps('old', 8));
    advance(11 * 60_000);
    arbiter.decide(U, gps('new', 8));
    assert.equal(arbiter.users.get(U)?.sessions.has('old'), false);
});

test('sourceOf: tells GPS, manual and no position apart', () => {
    assert.deepEqual(sourceOf([174.77, -41.28, 0], 8), { source: 'gps', accuracy: 8 });
    assert.deepEqual(sourceOf([174.77, -41.28, 0], undefined), { source: 'manual' });
    assert.deepEqual(sourceOf([174.77, -41.28, 0], 9999999), { source: 'manual' });
    assert.deepEqual(sourceOf([0, 0, 0], 8), { source: 'none' });
    assert.deepEqual(sourceOf(undefined, 8), { source: 'none' });
    assert.deepEqual(sourceOf([NaN, 1], 8), { source: 'none' });
});

test('LocationArbiter: a standby fix carries a stable marker uid and the session label', () => {
    const { arbiter, advance } = setup();
    arbiter.label(U, 'laptop', 'Chrome on Windows');
    assert.equal(arbiter.decide(U, gps('phone', 8)).secondary, undefined);
    advance(1000);
    const first = arbiter.decide(U, gps('laptop', 10)).secondary;
    advance(1000);
    const second = arbiter.decide(U, gps('laptop', 10)).secondary;
    assert.ok(first?.uid);
    assert.deepEqual(second, first);
    assert.equal(first.label, 'Chrome on Windows');
    assert.equal(arbiter.decide(U, { session: 'laptop', source: 'none', channel: 'ws' }).secondary, undefined);
});
