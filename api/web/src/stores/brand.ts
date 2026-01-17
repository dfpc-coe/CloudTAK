/*
* BrandStore - Maintain Branding accross pages
*/

import { std } from '../std.ts';
import type { LoginConfig } from '../types.ts';
import { defineStore } from 'pinia'

export const useBrandStore = defineStore('brand', {
    state: (): {
        loaded: boolean;
        isLoading: boolean;
        login: LoginConfig | undefined;
    } => {
        return {
            loaded: false,
            isLoading: false,
            login: undefined
        }
    },
    actions: {
        init: async function() {
            if (this.isLoading) return;

            if (!this.login) {
                this.isLoading = true;
                try {
                    this.login = await std('/api/config/login') as LoginConfig;
                    this.loaded = true;
                } catch (error) {
                    // Optionally log or handle the error here
                    throw error;
                } finally {
                    this.isLoading = false;
                }
            }
        }
    }
})
