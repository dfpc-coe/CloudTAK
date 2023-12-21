import { defineStore } from 'pinia'

export const useProfileStore = defineStore('profile', {
    state: () => {
        return {
            profile: null,
        }
    },
    actions: {
        load: async function() {
            this.profile = await window.std('/api/profile');
        }
    }
})
