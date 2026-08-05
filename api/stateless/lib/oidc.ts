import Err from '@openaddresses/batch-error';

export type OIDCConfig = {
    discovery: string;
    client: string;
    secret: string;
    redirect: string;
    scopes: string;
};

export type OIDCDiscovery = {
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
};

const DISCOVERY_CACHE_MS = 5 * 60 * 1000;

const discoveryCache = new Map<string, { fetched: number; doc: OIDCDiscovery }>();

/**
 * Fetch and cache the OpenID Connect Discovery document for the configured provider
 */
export async function discovery(url: string): Promise<OIDCDiscovery> {
    const cached = discoveryCache.get(url);
    if (cached && Date.now() - cached.fetched < DISCOVERY_CACHE_MS) {
        return cached.doc;
    }

    let res;
    try {
        res = await fetch(url, {
            headers: { Accept: 'application/json' },
        });
    } catch (err) {
        throw new Err(400, err instanceof Error ? err : null, 'Failed to fetch OIDC Discovery document');
    }

    if (!res.ok) throw new Err(400, null, `OIDC Discovery request failed: ${res.status}`);

    const doc = await res.json() as Record<string, unknown>;

    for (const key of ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint']) {
        if (typeof doc[key] !== 'string' || !doc[key]) {
            throw new Err(400, null, `OIDC Discovery document is missing ${key}`);
        }
    }

    const parsed: OIDCDiscovery = {
        authorization_endpoint: String(doc.authorization_endpoint),
        token_endpoint: String(doc.token_endpoint),
        userinfo_endpoint: String(doc.userinfo_endpoint),
    };

    discoveryCache.set(url, { fetched: Date.now(), doc: parsed });

    return parsed;
}

export function authorizationUrl(disc: OIDCDiscovery, oidc: OIDCConfig, state: string): string {
    const url = new URL(disc.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', oidc.client);
    url.searchParams.set('redirect_uri', oidc.redirect);
    url.searchParams.set('scope', oidc.scopes || 'openid profile email');
    url.searchParams.set('state', state);
    return String(url);
}

/**
 * Exchange an Authorization Code for tokens - performed server side over TLS
 * directly with the IdP so the returned tokens are implicitly trusted
 */
export async function exchangeCode(disc: OIDCDiscovery, oidc: OIDCConfig, code: string): Promise<{
    access_token: string;
    id_token?: string;
}> {
    let res;
    try {
        res = await fetch(disc.token_endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: String(new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: oidc.redirect,
                client_id: oidc.client,
                client_secret: oidc.secret,
            })),
        });
    } catch (err) {
        throw new Err(400, err instanceof Error ? err : null, 'OIDC Token Exchange failed');
    }

    if (!res.ok) throw new Err(401, null, `OIDC Token Exchange failed: ${res.status}`);

    const body = await res.json() as Record<string, unknown>;

    if (typeof body.access_token !== 'string' || !body.access_token) {
        throw new Err(401, null, 'OIDC Token Exchange did not return an access_token');
    }

    return {
        access_token: body.access_token,
        id_token: typeof body.id_token === 'string' ? body.id_token : undefined,
    };
}

/**
 * Validate the Access Token against the IdP's UserInfo endpoint and return the claims
 */
export async function userinfo(disc: OIDCDiscovery, accessToken: string): Promise<Record<string, unknown>> {
    let res;
    try {
        res = await fetch(disc.userinfo_endpoint, {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });
    } catch (err) {
        throw new Err(401, err instanceof Error ? err : null, 'OIDC UserInfo request failed');
    }

    if (!res.ok) throw new Err(401, null, `OIDC UserInfo request failed: ${res.status}`);

    return await res.json() as Record<string, unknown>;
}
