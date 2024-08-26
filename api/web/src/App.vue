<template>
    <div class='page h-100'>
        <header
            v-if='navShown'
            class='navbar navbar-expand-md d-print-none'
            data-bs-theme='dark'
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
                                :size='32'
                                :stroke='1'
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
                                    :size='32'
                                    :stroke='1'
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
                                        :size='32'
                                        :stroke='1'
                                    />
                                    <span class='mx-2'>Connections</span>
                                </div>
                                <div
                                    class='d-flex dropdown-item cursor-pointer hover-dark'
                                    @click='$router.push("/admin")'
                                >
                                    <IconSettings
                                        :size='32'
                                        :stroke='1'
                                    />
                                    <span class='mx-2'>Server</span>
                                    <span class='ms-auto badge border border-red bg-red text-white'>Admin</span>
                                </div>
                                <div
                                    class='d-flex dropdown-item cursor-pointer hover-dark'
                                    @click='logout'
                                >
                                    <IconLogout
                                        :size='32'
                                        :stroke='1'
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

        <Loading v-if='loading && !$route.path.includes("login")' />
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
            @close='login = null'
            @login='login=null'
        />
    </div>
</template>

<script>
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
import { useProfileStore } from '/src/stores/profile.ts';
import {
    TablerError
} from '@tak-ps/vue-tabler';
import { std, stdurl } from '/src/std.ts';

export default {
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
    data: function() {
        return {
            loading: true,
            login: false,
            mounted: false,
            user: null,
            err: null,
            server: null,
        }
    },
    computed: {
        docsURL: function() {
            return stdurl('/docs')
        },
        navShown: function() {
            if (!this.$route || !this.$route.name) {
                return false;
            } else {
                return (!this.$route.name.startsWith("home") && !["login"].includes(this.$route.name))
            }
        }
    },
    errorCaptured: function(err) {
        if (err.message === '401') {
            // Popup Modal if reauthenticating vs initial login
            this.login = true;
        } else if (String(err) === 'Error: Authentication Required') {
            this.routeLogin();
        } else {
            this.err = err;
        }
    },
    mounted: async function() {
        window.addEventListener('unhandledrejection', (e) => {
            this.err = e.reason;
        });

        if (localStorage.token) {
            await this.refreshLogin();
        } else if (this.$route.name !== 'login') {
            this.routeLogin();
        }

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

            const success = await this.getLogin();

            if (success) {
                await this.getServer()

                const profileStore = useProfileStore();
                await profileStore.load();
            }

            this.loading = false;
        },
        getLogin: async function() {
            try {
                this.user = await std('/api/login');
            } catch (err) {
                this.user = null;
                delete localStorage.token;
                
                if (this.$route.name !== 'login') {
                    this.routeLogin();
                }

                return false;
            }

            return true;
        },
        getServer: async function() {
            this.server = await std('/api/server');

            if (this.server.status === 'unconfigured') {
                this.$router.push("/admin");
            }
        }
    }
}
</script>

<style>
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
