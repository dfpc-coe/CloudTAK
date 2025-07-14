<template>
    <div class='page h-100 cloudtak-gradient'>
        <header
            v-if='navShown'
            class='navbar navbar-expand-md d-print-none'
        >
            <div class='container-xl'>
                <div class='col-auto'>
                    <img
                        class='cursor-pointer'
                        height='50'
                        width='50'
                        src='/logo.png'
                        @click='router.push("/")'
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
                            class='btn btn-dark'
                            target='_blank'
                            rel='noreferrer'
                            @click='externalDocs'
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
                                    class='d-flex dropdown-item cursor-pointer hover'
                                    @click='router.push("/connection")'
                                >
                                    <IconNetwork
                                        size='32'
                                        stroke='1'
                                    />
                                    <span class='mx-2'>Connections</span>
                                </div>
                                <div
                                    class='d-flex dropdown-item cursor-pointer hover'
                                    @click='router.push("/admin")'
                                >
                                    <IconSettings
                                        size='32'
                                        stroke='1'
                                    />
                                    <span class='mx-2'>Server</span>
                                    <span class='ms-auto badge border border-red bg-red text-white'>Admin</span>
                                </div>
                                <div
                                    class='d-flex dropdown-item cursor-pointer hover'
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

        <Loading v-if='loading && !route.path.includes("configure") && !route.path.includes("login")' />
        <router-view
            v-else
            :user='user'
            @err='error = $event'
            @login='refreshLogin'
        />
        <TablerError
            v-if='error'
            :err='error'
            @close='error = undefined'
        />
        <LoginModal
            v-if='login'
            @close='login = false'
            @login='login= false'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onErrorCaptured, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router';
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
import { std } from './std.ts';

const router = useRouter();
const route = useRoute();

const loading = ref(true);
const login = ref(false);
const mounted = ref(false);
const user = ref<Login | undefined>();
const error = ref<Error | undefined>();

const navShown = computed<boolean>(() => {
    if (!route || !route.name) {
        return false;
    } else {
        return (
            !String(route.name).startsWith("home")
            && !["login", "configure"].includes(String(route.name))
        )
    }
});

onErrorCaptured((err) => {
    if (!(err instanceof Error)) {
        error.value = new Error(String(err));
    }

    const e = err as Error;

    if (e.message === '401') {
        // Popup Modal if reauthenticating vs initial login

        if (route.name !== 'login') {
            login.value = true;
        }
    } else if (String(e) === 'Error: Authentication Required') {
        routeLogin();
    } else {
        error.value = e;
    }
});

onMounted(async () => {
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
        error.value = e.reason;
    });

    if (status === 'unconfigured') {
        delete localStorage.token;
        router.push("/configure");
    } else {
        if (localStorage.token) {
            await refreshLogin();
        } else if (route.name !== 'login') {
            routeLogin();
        }
    }

    loading.value = false;
    mounted.value = true;
});

function logout() {
    user.value = undefined;
    delete localStorage.token;
    router.push("/login");
}

function externalDocs() {
    window.location.href = '/docs';
}

function routeLogin() {
    router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
}

async function refreshLogin() {
    loading.value = true;

    await getLogin();

    loading.value = false;
}

async function getLogin() {
    try {
        user.value = await std('/api/login') as Login;
    } catch (err) {
        console.error(err);
        user.value = undefined;
        delete localStorage.token;

        if (route.name !== 'login') {
            routeLogin();
        }

        return false;
    }

    return true;
}
</script>

<style lang='scss'>
$cloudtak-default: #182433;
$cloudtak-child:  #192f45;
$cloudtak-yellow: #FFB703;
$cloudtak-orange: #FF9820;
$cloudtak-navy: #023047;
$cloudtak-blue: #07556D;

.cloudtak-gradient {
    background: radial-gradient(at left top, $cloudtak-blue, $cloudtak-navy);
}

.btn-primary {
    background-color: $cloudtak-blue !important;
}

.bg-child {
    background-color: $cloudtak-child !important;
}

html[data-bs-theme='dark'] .hover:hover {
    background: #0f172a;
}

html[data-bs-theme='light'] .hover:hover {
    background: #f5f5f5;
}

.hover-button-hidden {
    visibility: hidden;
}

.hover-button:hover .hover-button-hidden {
    visibility: visible;
}

.border-light {
    border-radius: 6px;
    background-color: rgba(0, 0, 0, 0.2);
}

.hover-button:hover {
    border-radius: 6px;
    background-color: rgba(0, 0, 0, 0.2);
}

.border-dark {
    background: #0f172a;
}
</style>
