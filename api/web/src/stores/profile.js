import { defineStore } from 'pinia'

export const useProfileStore = defineStore('profile', {
    state: () => {
        return {
            profile: null,
        }
    },
    actions: {
        CoT: function() {
            return {
                type: 'Feature',
                properties: {
                    type: 'a-f-G',
                    callsign: this.profile.tak_callsign,
                    droid: this.profile.tak_callsign
                },
                geometry: this.profile.tak_loc
            }
        },
        load: async function() {
            this.profile = await window.std('/api/profile');
        },
        update: async function(body) {
            this.profile = await window.std('/api/profile', {
                method: 'PATCH',
                body
            })
        }
    }
})
