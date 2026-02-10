/*
* BrandStore - Maintain Branding accross pages
*/

import { std } from '../std.ts';
import { db } from '../base/database.ts';
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
                    const config = await db.config.toArray();
                    const loginConfigMap = new Map((config || []).map(c => [c.key, c.value]));

                    if (loginConfigMap.has('login::username')) {
                        this.login = {
                            name: loginConfigMap.get('login::name') as string,
                            logo: loginConfigMap.get('login::logo') as string,
                            signup: loginConfigMap.get('login::signup') as string,
                            forgot: loginConfigMap.get('login::forgot') as string,
                            username: loginConfigMap.get('login::username') as string || 'Username or Email',
                            brand: {
                                enabled: loginConfigMap.get('login::brand::enabled') as "default" | "enabled" | "disabled" || 'default',
                                logo: loginConfigMap.get('login::brand::logo') as string
                            },
                            background: {
                                enabled: loginConfigMap.get('login::background::enabled') === 'true',
                                color: loginConfigMap.get('login::background::color') as string
                            }
                        };

                        this.loaded = true;
                    } else {
                        const res = await std('/api/config/login') as LoginConfig;

                        const ops = [];
                        if (res.name) ops.push({ key: 'login::name', value: res.name });
                        if (res.logo) ops.push({ key: 'login::logo', value: res.logo });
                        if (res.signup) ops.push({ key: 'login::signup', value: res.signup });
                        if (res.forgot) ops.push({ key: 'login::forgot', value: res.forgot });
                        if (res.username) ops.push({ key: 'login::username', value: res.username });
                        if (res.brand) {
                             if (res.brand.enabled) ops.push({ key: 'login::brand::enabled', value: res.brand.enabled });
                             if (res.brand.logo) ops.push({ key: 'login::brand::logo', value: res.brand.logo });
                        }
                        if (res.background) {
                             ops.push({ key: 'login::background::enabled', value: String(res.background.enabled) });
                             if (res.background.color) ops.push({ key: 'login::background::color', value: res.background.color });
                        }

                        await db.config.bulkPut(ops);

                        this.login = res;
                        this.loaded = true;
                    }
                } catch (error) {
                    // Optionally log or handle the error here
                    console.error('Failed to load login config:', error);
                    throw error;
                } finally {
                    this.isLoading = false;
                }
            }
        }
    }
})
