import { defineStore } from 'pinia'
import { std, stdurl } from '../std.ts';
import type { Group, Profile, Profile_Update } from '../types.ts';

export const useProfileStore = defineStore('profile', {
    state: (): {
        live_loc: number[] | undefined,
        channels: Array<Group>;
        profile: Profile | null;
    } => {
        return {
            live_loc: undefined,
            channels: [],
            profile: null,
        }
    },
    actions: {
        loadChannels: async function(): Promise<Array<Group>> {
            const url = stdurl('/api/marti/group');
            url.searchParams.append('useCache', 'true');
            this.channels = ((await std(url)) as {
                data: Group[]
            }).data

            return this.channels
        },
        update: async function(body: Profile_Update): Promise<void> {
            // TODO FIX THIS
            if (this.profile && body.tak_loc_freq && this.profile.tak_loc_freq !== body.tak_loc_freq) {
                //this.setupTimer();
            }

            this.profile = await std('/api/profile', {
                method: 'PATCH',
                body
            }) as Profile
        },
    }
})
