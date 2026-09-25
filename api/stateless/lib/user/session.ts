import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import Err from '@openaddresses/batch-error';
import { Type } from '@sinclair/typebox';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Request } from 'express';
import type { InferSelectModel } from 'drizzle-orm';
import { UAParser } from 'ua-parser-js';
import { AuthUserAccess, accessFor } from '../../../common/auth.js';
import { Profile, ProfileSession } from '../../../common/schema.js';
import type ConfigStateless from '../../config.js';
import type Config from '../../../common/config.js';
import type { HubClient } from '../../../common/hub/index.js';
import Provider from '../provider.js';

// Accepting the previous refresh token this soon after a rotation is a lost
// race between two tabs, not a replay - reject it without revoking the session
const ROTATION_GRACE_MS = 60 * 1000;

export const LoginResponse = Type.Object({
    token: Type.String(),
    refresh: Type.String({ description: 'Opaque token for POST /login/refresh - valid until the session expires' }),
    access: Type.Enum(AuthUserAccess),
    email: Type.String(),
    session: Type.String(),
    certRenewalRequired: Type.Optional(Type.Boolean({
        description: 'The stored TAK certificate is missing, revoked, expired or about to expire - the client should collect a password and call POST /login to regenerate it',
    })),
    certExpired: Type.Optional(Type.Boolean({
        description: 'The stored TAK certificate is unusable (missing, revoked or expired) - renewal cannot be skipped',
    })),
});

export type LoginResponseType = {
    token: string;
    refresh: string;
    access: AuthUserAccess;
    email: string;
    session: string;
    certRenewalRequired?: boolean;
    certExpired?: boolean;
};

export function hashRefresh(refresh: string): string {
    return createHash('sha256').update(refresh).digest('hex');
}

/**
 * Delete login sessions and tell any WebSocket clients still using them to log out
 */
export async function revokeSessions(config: Config & { hub?: HubClient }, sessions: string[]): Promise<void> {
    if (!sessions.length) return;

    await config.pg.delete(ProfileSession).where(inArray(ProfileSession.id, sessions));

    if (!config.hub) return;

    try {
        await config.hub.wsRevoke(sessions);
    } catch (err) {
        console.error('Error: Failed to close WebSocket clients of revoked sessions:', err);
    }
}

async function expiries(config: ConfigStateless): Promise<{ token: number; refresh: number }> {
    const settings = await config.models.Setting.typedMany({
        'login::token::expiry': 192,
        'login::refresh::expiry': 720,
    });

    return {
        token: settings['login::token::expiry'],
        refresh: settings['login::refresh::expiry'],
    };
}

function signToken(config: ConfigStateless, profile: InferSelectModel<typeof Profile>, session: string, hours: number): string {
    return jwt.sign(
        { access: accessFor(profile), email: profile.username, s: session },
        config.SigningSecret,
        { expiresIn: `${hours}h` },
    );
}

/**
 * Create a session for a freshly authenticated profile and mint its token pair
 */
export async function issueSession(
    config: ConfigStateless,
    req: Request<any, any, any, any>,
    profile: InferSelectModel<typeof Profile>,
): Promise<LoginResponseType> {
    const hours = await expiries(config);
    const refresh = randomBytes(32).toString('base64url');
    const userAgent = req.headers['user-agent'] || '';
    const ua = UAParser(userAgent);

    const session = await config.models.ProfileSession.generate({
        username: profile.username,
        created: new Date().toISOString(),
        ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown'),
        device_type: ua.device.type || 'Desktop',
        browser: [ua.browser.name, ua.browser.version].filter(Boolean).join(' ') || 'Unknown',
        os: [ua.os.name, ua.os.version].filter(Boolean).join(' ') || 'Unknown',
        user_agent: userAgent,
        refresh_hash: hashRefresh(refresh),
        refresh_expires: new Date(Date.now() + hours.refresh * 3600 * 1000).toISOString(),
    });

    return {
        access: accessFor(profile),
        email: profile.username,
        session: session.id,
        token: signToken(config, profile, session.id, hours.token),
        refresh,
    };
}

/**
 * Exchange a refresh token for a new token pair - the refresh token is rotated
 * and its session's absolute expiry is never extended
 */
export async function refreshSession(
    config: ConfigStateless,
    refresh: string,
): Promise<LoginResponseType> {
    const hash = hashRefresh(refresh);

    const [session] = await config.pg.select({
        id: ProfileSession.id,
        username: ProfileSession.username,
        expired: sql<boolean>`${ProfileSession.refresh_expires} IS NULL OR ${ProfileSession.refresh_expires} < Now()`,
    })
        .from(ProfileSession)
        .where(eq(ProfileSession.refresh_hash, hash))
        .limit(1);

    if (!session) {
        const [replayed] = await config.pg.select({
            id: ProfileSession.id,
            recent: sql<boolean>`${ProfileSession.last_refreshed} > Now() - make_interval(secs => ${ROTATION_GRACE_MS / 1000})`,
        })
            .from(ProfileSession)
            .where(eq(ProfileSession.refresh_previous_hash, hash))
            .limit(1);

        if (replayed && !replayed.recent) {
            await revokeSessions(config, [replayed.id]);
            throw new Err(401, null, 'Refresh token reuse detected - session revoked');
        }

        throw new Err(401, null, 'Invalid refresh token');
    }

    if (session.expired) {
        await revokeSessions(config, [session.id]);
        throw new Err(401, null, 'Session has expired');
    }

    const profile = await config.models.Profile.from(session.username);
    if (profile.disabled) throw new Err(401, null, 'User is disabled');

    const hours = await expiries(config);
    const next = randomBytes(32).toString('base64url');

    await config.models.ProfileSession.commit(session.id, {
        refresh_hash: hashRefresh(next),
        refresh_previous_hash: hash,
        last_refreshed: new Date().toISOString(),
    });

    return {
        access: accessFor(profile),
        email: profile.username,
        session: session.id,
        token: signToken(config, profile, session.id, hours.token),
        refresh: next,
        ...await certificateStatus(config, profile),
    };
}

/**
 * Whether a login without a password (passkey, refresh) must be followed by
 * a password login so the TAK certificate can be regenerated
 */
export async function certificateStatus(
    config: ConfigStateless,
    profile: InferSelectModel<typeof Profile>,
): Promise<{ certRenewalRequired?: true; certExpired?: true }> {
    let certRenewalRequired = Provider.certificateRenewalRequired(profile.auth?.cert);
    let certExpired = Provider.certificateExpired(profile.auth?.cert);

    if (!certRenewalRequired && config.server.auth.key && config.server.auth.cert) {
        try {
            await new Provider(config).valid(profile);
        } catch (err) {
            if (err instanceof Err && err.status === 401) {
                certRenewalRequired = true;
                certExpired = true;
            } else {
                // TAK Server is unreachable - don't block login on a check we can't perform
                console.error(err);
            }
        }
    }

    return {
        ...(certRenewalRequired ? { certRenewalRequired: true } : {}),
        ...(certExpired ? { certExpired: true } : {}),
    };
}
