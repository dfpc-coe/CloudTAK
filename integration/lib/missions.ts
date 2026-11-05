import type { Page } from '@playwright/test';
import { getStoredToken } from './session.ts';
import { cloudtakUrl } from './env.ts';

export type MissionCreateBody = {
    name: string;
    group: string[];
    description?: string;
    keywords?: string[];
    defaultRole?: string;
    password?: string;
};

export type MissionSummary = {
    guid: string;
    name: string;
    passwordProtected: boolean;
    keywords?: string[];
    description?: string;
    token?: string;
};

async function authHeaders(page: Page): Promise<Record<string, string>> {
    const token = await getStoredToken(page);
    return { Authorization: `Bearer ${token ?? ''}` };
}

// Direct create, bypassing the Create Mission form (stands in for ATAK et al)
export async function apiCreateMission(page: Page, body: MissionCreateBody): Promise<MissionSummary> {
    const res = await page.request.post(`${cloudtakUrl()}/api/marti/mission`, {
        headers: await authHeaders(page),
        data: body,
    });
    if (!res.ok()) throw new Error(`Failed to create mission ${body.name}: HTTP ${res.status()}`);
    return await res.json() as MissionSummary;
}

export async function apiGetMissionToken(page: Page, guid: string, password: string): Promise<string> {
    const res = await page.request.get(
        `${cloudtakUrl()}/api/marti/missions/${encodeURIComponent(guid)}?changes=false&logs=false&password=${encodeURIComponent(password)}`,
        { headers: await authHeaders(page) },
    );
    if (!res.ok()) throw new Error(`Failed to fetch mission ${guid} token: HTTP ${res.status()}`);
    const body = await res.json() as { token?: string };
    if (!body.token) throw new Error(`Mission ${guid} returned no token`);
    return body.token;
}

export async function apiDeleteMission(page: Page, guid: string, opts: { password?: string } = {}): Promise<void> {
    const headers = await authHeaders(page);
    if (opts.password) headers['MissionAuthorization'] = await apiGetMissionToken(page, guid, opts.password);
    const res = await page.request.delete(`${cloudtakUrl()}/api/marti/missions/${encodeURIComponent(guid)}`, {
        headers,
    });
    if (!res.ok()) {
        throw new Error(`Failed to delete QA-TEST mission ${guid}: HTTP ${res.status()} - remove it from staging manually`);
    }
}

export async function apiSubmitMissionFeature(page: Page, guid: string, callsign: string): Promise<number> {
    // PUT on staging 13.102; newer releases switched this route to POST
    const res = await page.request.put(`${cloudtakUrl()}/api/marti/missions/${encodeURIComponent(guid)}/cot`, {
        headers: await authHeaders(page),
        data: {
            features: [{
                id: crypto.randomUUID(),
                type: 'Feature',
                properties: {
                    type: 'a-f-G-U-C',
                    how: 'h-g-i-g-o',
                    callsign,
                },
                geometry: { type: 'Point', coordinates: [-105.1, 39.7] },
            }],
        },
    });
    return res.status();
}

export async function apiGetClientCallsign(page: Page, username: string): Promise<string> {
    const res = await page.request.get(`${cloudtakUrl()}/api/marti/clients?secago=3600`, {
        headers: await authHeaders(page),
    });
    if (!res.ok()) throw new Error(`Failed to list TAK clients: HTTP ${res.status()}`);
    const body = await res.json() as { data?: Array<{ callsign: string; username: string }>; items?: Array<{ callsign: string; username: string }> };
    const client = (body.data ?? body.items ?? []).find((c) => c.username?.toLowerCase() === username.toLowerCase());
    if (!client) throw new Error(`No connected TAK client found for ${username}`);
    return client.callsign;
}

export async function apiGetMissionRole(page: Page, guid: string): Promise<{ type: string; permissions: string[] }> {
    const res = await page.request.get(`${cloudtakUrl()}/api/marti/missions/${encodeURIComponent(guid)}/role`, {
        headers: await authHeaders(page),
    });
    if (!res.ok()) throw new Error(`Failed to fetch mission role: HTTP ${res.status()}`);
    return await res.json() as { type: string; permissions: string[] };
}

export async function apiListMissions(page: Page): Promise<MissionSummary[]> {
    const res = await page.request.get(
        `${cloudtakUrl()}/api/marti/mission?passwordProtected=true&defaultRole=true&sort=createTime&order=desc`,
        { headers: await authHeaders(page) },
    );
    if (!res.ok()) throw new Error(`Failed to list missions: HTTP ${res.status()}`);
    const body = await res.json() as { items?: MissionSummary[]; data?: MissionSummary[] };
    return body.items ?? body.data ?? [];
}
