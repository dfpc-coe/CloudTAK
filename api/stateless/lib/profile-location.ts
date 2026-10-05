import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { TAKGroup, TAKRole } from '@tak-ps/node-tak/lib/api/types';
import type { Profile } from '../../common/types.js';
import { profileUid } from '../../common/control/takserver.js';

export const ProfileLocationBody = Type.Object({
    longitude: Type.Number(),
    latitude: Type.Number(),
    altitude: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    accuracy: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    altitudeAccuracy: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    speed: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    bearing: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    time: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
});

/**
 * Type reported for the user's own position - always the TAK team member type.
 * `profile.tak_type` is the Default Point Type for features the user creates
 * and is a 2525 SIDC, which would render the user as a MIL-STD symbol instead
 * of a team skittle in native clients
 */
export const SELF_COT_TYPE = 'a-f-G-E-V-C';

export function selfLocationFeature(
    username: string,
    profile: Partial<Pick<Static<typeof Profile>, 'tak_callsign' | 'tak_remarks' | 'tak_group' | 'tak_role'>>,
    body: Static<typeof ProfileLocationBody>,
) {
    const now = typeof body.time === 'number' ? new Date(body.time) : new Date();
    const stale = new Date(now.getTime() + 60_000);
    const callsign = profile.tak_callsign || 'Unknown';
    const uid = profileUid(username);

    return {
        id: uid,
        type: 'Feature' as const,
        path: '/',
        properties: {
            callsign,
            type: SELF_COT_TYPE,
            how: 'm-g',
            time: now.toISOString(),
            start: now.toISOString(),
            stale: stale.toISOString(),
            center: [body.longitude, body.latitude],
            remarks: profile.tak_remarks || '',
            ...(typeof body.accuracy === 'number' && { ce: body.accuracy }),
            ...(typeof body.speed === 'number' && { speed: body.speed }),
            ...(typeof body.bearing === 'number' && { course: body.bearing }),
            droid: callsign,
            contact: { endpoint: '*:-1:stcp', callsign },
            group: { name: profile.tak_group || TAKGroup.CYAN, role: profile.tak_role || TAKRole.TEAM_MEMBER },
        },
        geometry: {
            type: 'Point' as const,
            coordinates: [body.longitude, body.latitude, body.altitude ?? 0],
        },
    };
}
