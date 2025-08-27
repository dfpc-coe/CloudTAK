/*
* BrandStore - Maintain Branding accross pages
*/

import { server } from '../std.ts';
import type { LoginConfig } from '../types.ts';
import { defineStore } from 'pinia'

export const useBrandStore = defineStore('brand', {
    state: (): {
        loaded: boolean;
        login: LoginConfig | undefined;
    } => {
        return {
            loaded: false,
            login: undefined
        }
    },
    actions: {
        init: async function() {
            if (!this.login) {
                const { data, error } = await server.GET('/api/config/login');
                if (error) throw new Error('Could not fetch login config');
                this.login = data;
            }

            this.loaded = true;
        }
    }
})
