/*
* BrandStore - Maintain Branding accross pages
*/

import { std } from '../std.ts';
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
                this.login = await std('/api/config/login') as LoginConfig;
            }

            this.loaded = true;
        }
    }
})
