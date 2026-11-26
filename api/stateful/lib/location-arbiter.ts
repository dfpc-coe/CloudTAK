/**
 * Picks one session per user as the broadcaster of their location, as every
 * session of a user shares one self CoT uid. Fixes from the other sessions are
 * sent to the TAK Server as a plain marker of that session, not as the user.
 *
 * In order: an explicit claim wins, GPS beats a manual location, the
 * broadcaster keeps the role while it reports, a challenger needs a clearly
 * better GPS fix and a silent broadcaster is replaced by the best fresh session.
 *
 * A session without a position still sends an SA at 0,0, as TAK Server needs
 * one to register the connection. It is never the broadcaster and is dropped
 * while another session broadcasts a position.
 *
 * Fails open: a fix without a session, a sole session and any fix after a
 * restart are accepted.
 */

import { randomUUID } from 'node:crypto';
import type CoT from '@tak-ps/node-cot';

export type FixSource = 'gps' | 'manual' | 'none';

/** Which path a fix arrived on. The native layer POSTs, the worker uses the WebSocket */
export type FixChannel = 'ws' | 'post';

export type Fix = {
    session?: string;
    source: FixSource;
    /** GPS accuracy in meters, when known */
    accuracy?: number | null;
    channel: FixChannel;
};

export type Decision = {
    /** The fix should be forwarded to TAK Server */
    accept: boolean;
    /** Why a fix was refused or the role moved, for the log */
    reason: string;
    /** The broadcaster changed as a result of this fix */
    changed: boolean;
    /** A refused fix that is a real position, forwarded as a marker of its own instead */
    secondary?: { uid: string; label?: string };
};

export type ArbiterOptions = {
    /** Floor for how long a session may stay silent before it is considered gone */
    staleMs: number;
    /** A challenger needs this many times better accuracy... */
    betterRatio: number;
    /** ...and at least this many meters better, to displace a healthy broadcaster */
    betterMeters: number;
    /** How long a Take over waits for the claiming session's next fix */
    claimTtlMs: number;
    now: () => number;
};

const DEFAULT_ARBITER_OPTIONS: ArbiterOptions = {
    staleMs: 15_000,
    betterRatio: 3,
    betterMeters: 50,
    claimTtlMs: 60_000,
    now: () => Date.now(),
};

type SessionState = {
    /** Last time anything was heard from the session, used only to forget it */
    seen: number;
    /** Last time a fix arrived. 0 until the first one */
    lastFix: number;
    /** Gap between the last two fixes, so a slow reporting rate is not mistaken for silence */
    gap: number;
    source: FixSource;
    accuracy?: number;
    /** Last time a valid fix arrived over the WebSocket - the richer source while the app is open */
    lastWsFix?: number;
    label?: string;
    /** uid of the marker this session reports under while it is not the broadcaster */
    uid: string;
};

type UserState = {
    holder?: string;
    /** The holder was chosen explicitly and is not displaced automatically */
    pinned: boolean;
    sessions: Map<string, SessionState>;
    /** Take over requests waiting for that session's next valid fix */
    claims: Map<string, number>;
};

const MAX_STALE_MS = 5 * 60_000;
const FORGET_AFTER_MS = 10 * 60_000;

const RANK: Record<FixSource, number> = { gps: 2, manual: 1, none: 0 };

export default class LocationArbiter {
    opts: ArbiterOptions;
    users: Map<string, UserState> = new Map();

    constructor(opts: Partial<ArbiterOptions> = {}) {
        this.opts = { ...DEFAULT_ARBITER_OPTIONS, ...opts };
    }

    #user(user: string): UserState {
        let state = this.users.get(user);
        if (!state) {
            state = { pinned: false, sessions: new Map(), claims: new Map() };
            this.users.set(user, state);
        }
        return state;
    }

    #staleAfter(session: SessionState): number {
        return Math.min(MAX_STALE_MS, Math.max(this.opts.staleMs, session.gap * 3));
    }

    #fresh(session: SessionState | undefined, now: number): boolean {
        if (!session) return false;
        return now - session.lastFix <= this.#staleAfter(session);
    }

    /** Best session by source rank, then accuracy, among those with a recent usable fix */
    #best(state: UserState, now: number): string | undefined {
        let best: string | undefined;
        for (const [id, session] of state.sessions) {
            if (session.source === 'none' || !this.#fresh(session, now)) continue;
            if (!best) {
                best = id;
                continue;
            }
            const other = state.sessions.get(best) as SessionState;
            if (RANK[session.source] !== RANK[other.source]) {
                if (RANK[session.source] > RANK[other.source]) best = id;
            } else if ((session.accuracy ?? Infinity) < (other.accuracy ?? Infinity)) {
                best = id;
            }
        }
        return best;
    }

    #forget(user: string, state: UserState, now: number): void {
        for (const [id, session] of state.sessions) {
            if (now - Math.max(session.seen, session.lastFix) > FORGET_AFTER_MS) {
                state.sessions.delete(id);
                state.claims.delete(id);
            }
        }
        if (!state.sessions.size && !state.claims.size) this.users.delete(user);
    }

    /** Record a label ("Pixel 8 (app)") shown to the user's other sessions */
    label(user: string, session: string, label: string): void {
        const state = this.#user(user);
        const existing = state.sessions.get(session);
        if (existing) {
            existing.label = label;
        } else {
            state.sessions.set(session, {
                seen: this.opts.now(), lastFix: 0, gap: 0, source: 'none', label, uid: randomUUID(),
            });
        }
    }

    /**
     * The user asked this session to become the broadcaster. It takes effect
     * with the session's next usable fix, so a session with no position can
     * never silence one that has
     */
    claim(user: string, session: string): void {
        this.#user(user).claims.set(session, this.opts.now());
    }

    /** Decide whether a fix from `fix.session` should be forwarded */
    decide(user: string, fix: Fix): Decision {
        const decision = this.#decide(user, fix);
        if (decision.changed) {
            console.log(`ok - location - ${user} - session ${fix.session} (${fix.channel}, ${fix.source}) is now the broadcaster: ${decision.reason}`);
        }
        return decision;
    }

    #decide(user: string, fix: Fix): Decision {
        const now = this.opts.now();

        // A token without a session (server minted) cannot be arbitrated
        if (!fix.session) return { accept: true, reason: 'no session', changed: false };

        if (fix.source === 'none') {
            // TAK Server registers the connection from the first SA it carries, so a
            // 0,0 SA is forwarded unless another session is broadcasting a position
            const known = this.users.get(user);
            if (known?.holder === fix.session) {
                known.holder = undefined;
                known.pinned = false;
            }
            const holder = known?.holder ? known.sessions.get(known.holder) : undefined;
            if (this.#fresh(holder, now)) return { accept: false, reason: 'standby', changed: false };
            return { accept: true, reason: 'no position', changed: false };
        }

        const state = this.#user(user);
        const previous = state.sessions.get(fix.session);
        const session: SessionState = {
            seen: now,
            lastFix: now,
            gap: previous && previous.lastFix ? Math.min(now - previous.lastFix, MAX_STALE_MS) : 0,
            source: fix.source,
            accuracy: typeof fix.accuracy === 'number' && fix.accuracy > 0 ? fix.accuracy : undefined,
            lastWsFix: fix.channel === 'ws' ? now : previous?.lastWsFix,
            label: previous?.label,
            uid: previous?.uid ?? randomUUID(),
        };
        const standby: Decision = {
            accept: false, reason: 'standby', changed: false,
            secondary: { uid: session.uid, label: session.label },
        };

        // While the open app reports over the WebSocket (battery, takv), its native
        // POSTs carry the same position with less detail. Ignore them until the
        // WebSocket goes quiet, which is what a suspended WebView looks like
        if (fix.channel === 'post' && previous?.lastWsFix !== undefined
            && now - previous.lastWsFix <= this.#staleAfter(previous)) {
            // Still counts as the session being alive
            previous.lastFix = now;
            previous.seen = now;
            return { accept: false, reason: 'duplicate of websocket fix', changed: false };
        }

        state.sessions.set(fix.session, session);
        this.#forget(user, state, now);

        let changed = false;
        const promote = (id: string, pinned: boolean) => {
            changed = state.holder !== id;
            state.holder = id;
            state.pinned = pinned;
        };

        // Rule 1: an explicit claim takes effect on this session's next usable fix
        const claimedAt = state.claims.get(fix.session);
        if (claimedAt !== undefined) {
            state.claims.delete(fix.session);
            if (now - claimedAt <= this.opts.claimTtlMs) {
                promote(fix.session, true);
                return { accept: true, reason: changed ? 'claimed' : 'claimed (already live)', changed };
            }
        }

        const holder = state.holder ? state.sessions.get(state.holder) : undefined;

        // No broadcaster yet, or this session is it
        if (!state.holder || state.holder === fix.session) {
            if (!state.holder) promote(fix.session, false);
            return { accept: true, reason: 'broadcaster', changed };
        }

        // Rule 5: the broadcaster went quiet - the best fresh session takes over
        if (!this.#fresh(holder, now)) {
            const best = this.#best(state, now);
            if (best === fix.session) {
                promote(fix.session, false);
                return { accept: true, reason: 'broadcaster went quiet', changed };
            }
            return standby;
        }

        // Rule 1 again: a pinned broadcaster is only replaced by an explicit claim
        if (state.pinned) return standby;

        const holderSession = holder as SessionState;

        // Rule 2: live GPS beats a manual location
        if (RANK[fix.source] > RANK[holderSession.source]) {
            promote(fix.session, false);
            return { accept: true, reason: 'gps over manual', changed };
        }

        // Rule 4: only a clearly better GPS fix displaces a healthy broadcaster
        if (fix.source === 'gps' && holderSession.source === 'gps'
            && session.accuracy !== undefined && holderSession.accuracy !== undefined
            && session.accuracy * this.opts.betterRatio <= holderSession.accuracy
            && holderSession.accuracy - session.accuracy >= this.opts.betterMeters) {
            promote(fix.session, false);
            return { accept: true, reason: 'clearly better fix', changed };
        }

        return standby;
    }

    /**
     * What a session should show: live, or standby with the label of whoever
     * is broadcasting. With no broadcaster, a stale one, or no session, the
     * answer is live, so a lone session is never told it has been displaced
     */
    state(user: string, session: string | undefined): { active: boolean; by?: string } {
        if (!session) return { active: true };
        const state = this.users.get(user);
        if (!state || !state.holder || state.holder === session) return { active: true };
        const holder = state.sessions.get(state.holder);
        if (!this.#fresh(holder, this.opts.now())) return { active: true };
        return { active: false, by: holder?.label };
    }
}

/**
 * Work out what a self-location CoT carries: no position (0,0), a GPS fix
 * (the worker sets `ce` from the fix accuracy) or a manual location (no `ce`)
 */
export function sourceOf(
    coordinates: unknown,
    ce: unknown,
): { source: FixSource; accuracy?: number } {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return { source: 'none' };
    const lon = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return { source: 'none' };
    if (Math.abs(lon) < 1e-6 && Math.abs(lat) < 1e-6) return { source: 'none' };
    // CoT's "unknown circular error" is 9999999
    if (typeof ce === 'number' && Number.isFinite(ce) && ce > 0 && ce < 9_999_999) {
        return { source: 'gps', accuracy: ce };
    }
    return { source: 'manual' };
}

/**
 * Turn a self position into a plain marker of the session that reported it, so
 * a device that is not the broadcaster stays on the map without moving the user
 */
export function toSecondary(cot: CoT, secondary: NonNullable<Decision['secondary']>): void {
    const callsign = cot.callsign();
    const detail = cot.detail();

    cot.uid(secondary.uid);
    delete detail.__group;
    delete detail.takv;
    delete detail.uid;
    detail.contact = {
        _attributes: { callsign: secondary.label ? `${callsign} (${secondary.label})` : callsign },
    };
}
