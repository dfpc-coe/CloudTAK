<template>
    <div class='page h-100 cloudtak-gradient'>
        <header
            v-if='navShown'
            class='navbar navbar-expand-md d-print-none'
            data-bs-theme='dark'
            data-bs-theme-base='neutral'
            data-bs-theme-primary='blue'
        >
            <div class='container-xl'>
                <div class='col-auto'>
                    <img
                        class='cursor-pointer'
                        height='50'
                        width='50'
                        src='/logo.png'
                        @click='$router.push("/")'
                    >
                </div>
                <div class='col mx-2'>
                    <div class='page-pretitle'>
                        Colorado - DFPC - CoE
                    </div>
                    <h2 class='page-title'>
                        CloudTAK
                    </h2>
                </div>

                <div
                    v-if='user'
                    class='ms-auto'
                >
                    <div class='btn-list'>
                        <a
                            :href='docsURL'
                            class='btn btn-dark'
                            target='_blank'
                            rel='noreferrer'
                        >
                            <IconCode
                                size='32'
                                stroke='1'
                            />Docs
                        </a>
                        <div class='dropdown'>
                            <div
                                id='userProfileButton'
                                type='button'
                                data-bs-toggle='dropdown'
                                aria-expanded='false'
                                class='btn btn-dark'
                            >
                                <IconUser
                                    size='32'
                                    stroke='1'
                                />
                            </div>
                            <ul
                                class='dropdown-menu'
                                aria-labelledby='userProfileButton'
                            >
                                <div
                                    class='d-flex dropdown-item cursor-pointer hover-dark'
                                    @click='$router.push("/connection")'
                                >
                                    <IconNetwork
                                        size='32'
                                        stroke='1'
                                    />
                                    <span class='mx-2'>Connections</span>
                                </div>
                                <div
                                    class='d-flex dropdown-item cursor-pointer hover-dark'
                                    @click='$router.push("/admin")'
                                >
                                    <IconSettings
                                        size='32'
                                        stroke='1'
                                    />
                                    <span class='mx-2'>Server</span>
                                    <span class='ms-auto badge border border-red bg-red text-white'>Admin</span>
                                </div>
                                <div
                                    class='d-flex dropdown-item cursor-pointer hover-dark'
                                    @click='logout'
                                >
                                    <IconLogout
                                        size='32'
                                        stroke='1'
                                    />
                                    <span class='mx-2'>Logout</span>
                                </div>
                            </ul>
                        </div>
                        <div />
                    </div>
                </div>
            </div>
        </header>

        <Loading v-if='loading && !$route.path.includes("configure") && !$route.path.includes("login")' />
        <router-view
            v-else
            :user='user'
            @err='err = $event'
            @login='refreshLogin'
        />
        <TablerError
            v-if='err'
            :err='err'
            @close='err = null'
        />
        <LoginModal
            v-if='login'
            @close='login = false'
            @login='login= false'
        />
    </div>
</template>

<script lang='ts'>
import { defineComponent } from 'vue'
import type { Login, Server } from './types.ts';
import { useBrandStore } from './stores/brand.ts';
import '@tabler/core/dist/js/tabler.min.js';
import '@tabler/core/dist/css/tabler.min.css';
import LoginModal from './components/util/LoginModal.vue'
import {
    IconCode,
    IconLogout,
    IconUser,
    IconNetwork,
    IconSettings,
} from '@tabler/icons-vue';
import Loading from './components/Loading.vue';
import {
    TablerError
} from '@tak-ps/vue-tabler';
import { std, stdurl } from './std.ts';

export default defineComponent({
    name: 'TakPSETL',
    components: {
        LoginModal,
        IconCode,
        IconSettings,
        IconLogout,
        IconUser,
        IconNetwork,
        TablerError,
        Loading,
    },
    data: function(): {
        loading: boolean;
        login: boolean;
        mounted: boolean;
        err: null | Error;
        user: null | Login;
    }{
        return {
            loading: true,
            login: false,
            mounted: false,
            user: null,
            err: null,
        }
    },
    computed: {
        docsURL: function(): string {
            return String(stdurl('/docs'))
        },
        navShown: function() {
            if (!this.$route || !this.$route.name) {
                return false;
            } else {
                return (
                    !String(this.$route.name).startsWith("home")
                    && !["login", "configure"].includes(String(this.$route.name))
                )
            }
        }
    },
    errorCaptured: function(err) {
        if (!(err instanceof Error)) {
            err = new Error(String(err));
        }

        const e = err as Error;

        if (e.message === '401') {
            // Popup Modal if reauthenticating vs initial login
            this.login = true;
        } else if (String(e) === 'Error: Authentication Required') {
            this.routeLogin();
        } else {
            this.err = e;
        }
    },
    mounted: async function() {
        let status;
        try {
            const server = await std('/api/server') as Server;
            status = server.status;
        } catch (err) {
            console.warn('Server Error (Likely the server is in a configured state)', err);
            status = 'configured';
        }

        const brandStore = useBrandStore();
        await brandStore.init();

        window.addEventListener('unhandledrejection', (e) => {
            this.err = e.reason;
        });

        if (status === 'unconfigured') {
            delete localStorage.token;
            this.$router.push("/configure");
        } else {
            if (localStorage.token) {
                await this.refreshLogin();
            } else if (this.$route.name !== 'login') {
                this.routeLogin();
            }
        }

        this.loading = false;
        this.mounted = true;
    },
    methods: {
        logout: function() {
            this.user = null;
            delete localStorage.token;
            this.$router.push("/login");
        },
        routeLogin: function() {
            this.$router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        },
        refreshLogin: async function() {
            this.loading = true;

            await this.getLogin();

            this.loading = false;
        },
        getLogin: async function() {
            try {
                this.user = await std('/api/login') as Login;
            } catch (err) {
                console.error(err);
                this.user = null;
                delete localStorage.token;

                if (this.$route.name !== 'login') {
                    this.routeLogin();
                }

                return false;
            }

            return true;
        },
    }
});
</script>

<style lang='scss'>
$cloudtak-yellow: #FFB703;
$cloudtak-orange: #FF9820;
$cloudtak-navy: #023047;
$cloudtak-blue: #07556D;

.cloudtak-gradient {
    background: radial-gradient(at left top, $cloudtak-blue, $cloudtak-navy);
}

.btn-primary {
    background-color: #07556D !important;
}

.hover-button-hidden {
    visibility: hidden;
}

.hover-button:hover .hover-button-hidden {
    visibility: visible;
}

.hover-light:hover {
    background: #f5f5f5;
}

.border-light {
    border-radius: 6px;
    background-color: rgba(0, 0, 0, 0.2);
}

.hover-button:hover {
    border-radius: 6px;
    background-color: rgba(0, 0, 0, 0.2);
}

.hover-dark:hover {
    background: #0f172a;
}

.border-dark {
    background: #0f172a;
}
</style>
