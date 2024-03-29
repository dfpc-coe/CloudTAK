import { defineStore } from 'pinia'
import { std } from '../std.ts';

export const useProfileStore = defineStore('profile', {
    state: () => {
        return {
            id: `ANDROID-${(Math.random() + 1).toString(36).substring(2)}`,
            notifications: [],
            profile: null,
        }
    },
    actions: {
        CoT: function() {
            return {
                id: this.id,
                type: 'Feature',
                properties: {
                    type: 'a-f-G-E-V-C',
                    how: 'm-g',
                    callsign: this.profile.tak_callsign,
                    droid: this.profile.tak_callsign,
                    contact:{
                        endpoint:"*:-1:stcp",
                        callsign: this.profile.tak_callsign,
                    },
                    group: {
                        name: this.profile.tak_group,
                        role: this.profile.tak_role
                    },
                    takv: {
                        device: navigator.userAgent,
                        platform: 'CloudTAK',
                        os: navigator.oscpu,
                        //TODO Use versions
                        version: '1.0.0'
                    }
                },
                geometry: this.profile.tak_loc
            }
        },
        load: async function() {
            this.profile = await std('/api/profile');
        },
        update: async function(body) {
            this.profile = await std('/api/profile', {
                method: 'PATCH',
                body
            })
        }
    }
})
