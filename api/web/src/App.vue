<template>
    <div class='page h-100 cloudtak-gradient'>
        <!-- New-version upgrade banner -->
        <div
            v-if='updateAvailable'
            class='d-flex align-items-center justify-content-center flex-wrap gap-2 px-3 py-2'
            style='background: rgba(20,20,20,0.88); backdrop-filter: blur(6px);'
        >
            <IconRefresh
                size='16'
                class='text-success flex-shrink-0'
            />
            <span class='text-white small'>
                A new version of CloudTAK is ready
                <template v-if='updatedSW.version && updatedSW.version !== version'>
                    &mdash; v{{ version }} &rarr; v{{ updatedSW.version }}
                </template>
            </span>
            <button
                class='btn btn-sm btn-success py-0'
                @click='applyUpdate'
            >
                Update Now
            </button>
            <button
                class='btn-close btn-close-white'
                style='font-size: 0.65rem;'
                @click='updateAvailable = false'
            />
        </div>
        <header
            v-if='navShown'
            class='navbar navbar-expand-md d-print-none'
        >
            <div class='container-xl'>
                <div class='col-auto'>
                    <img
                        alt='Agency Logo'
                        :src='loginLogo || "/CloudTAKLogo.svg"'
                        class='cursor-pointer'
                        draggable='false'
                        height='50'
                        width='50'
                        @click='external("/")'
                    >
                </div>
                <div class='col mx-2'>
                    <div
                        class='page-pretitle'
                        v-text='loginName || ""'
                    />
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
                            @click='external("/docs")'
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
                                    @click='external("/connection")'
                                >
                                    <IconNetwork
                                        size='32'
                                        stroke='1'
                                    />
                                    <span class='mx-2'>Connections</span>
                                </div>
                                <div
                                    class='d-flex dropdown-item cursor-pointer hover'
                                    @click='external("/admin")'
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

        <Loading
            v-if='loading && !route.path.includes("configure") && !route.path.includes("login")'
        />
        <router-view
            v-else
            @err='error = $event'
            @login='refreshLogin'
        />
        <TablerError
            v-if='error'
            :err='error'
            @close='error = undefined'
        />
        <MissionInviteModal
            v-if='inviteMission'
            :mission='inviteMission'
            @close='inviteMission = undefined'
        />
        <ChannelChangeModal
            v-if='channelChange'
            @close='channelChange = false'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onErrorCaptured, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router';
import Config from './base/config.ts';
import ServerManager from './base/server.ts';
import '@tabler/core/dist/js/tabler.min.js';
import '@tabler/core/dist/css/tabler.min.css';
import {
    IconCode,
    IconLogout,
    IconUser,
    IconNetwork,
    IconSettings,
    IconRefresh,
} from '@tabler/icons-vue';
import { version } from '../package.json';
import Loading from './components/Loading.vue';
import {
    TablerError
} from '@tak-ps/vue-tabler';
import MissionInviteModal from './components/CloudTAK/Menu/Mission/MissionInviteModal.vue';
import ChannelChangeModal from './components/CloudTAK/Menu/ChannelChangeModal.vue';
import { WorkerMessageType } from './base/events.ts';
import type { WorkerMessage } from './base/events.ts';
import { db } from './base/database.ts';
import { useMapStore } from './stores/map.ts';

const router = useRouter();
const route = useRoute();
const mapStore = useMapStore();

const loginLogo = ref<string>();
const loginName = ref<string>();

const updateAvailable = ref(false);
const updatedSW = ref<{ version: string | null; build: string | null }>({ version: null, build: null });

const applyUpdate = () => {
    window.location.reload();
};

const onSwUpdated = async (e: Event) => {
    e.preventDefault();

    try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
            const worker = reg.active;
            if (worker?.scriptURL) {
                const u = new URL(worker.scriptURL);
                updatedSW.value = {
                    version: u.searchParams.get('v'),
                    build: u.searchParams.get('build')
                };
                break;
            }
        }
    } catch { /* ignore */ }

    updateAvailable.value = true;
};

const loading = ref(true);
const inviteMission = ref<{
    name: string;
    guid: string;
    token: string;
    authorUid: string;
    tool: string;
    type: string;
} | undefined>();
const channelChange = ref(false);
const mounted = ref(false);
const user = ref(false);
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
            routeLogin();
        }
    } else if (String(e) === 'Error: Authentication Required') {
        routeLogin();
    } else {
        error.value = e;
    }
});

onMounted(async () => {
    // Register before any awaits so early promise rejections are captured
    window.addEventListener('unhandledrejection', (e) => {
        error.value = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    });

    let status;

    const username = await db.profile.get('username');

    if (username) {
        status = 'configured';
    } else {
        try {
            const server = await ServerManager.get();
            status = server.status;
        } catch (err) {
            console.warn('Server Error (Likely the server is in a configured state)', err);
            status = 'configured';
        }
    }

    const config = await Config.list([
        'login::name',
        'login::logo',
        'login::brand::enabled',
        'login::brand::logo',
        'login::background::enabled',
        'login::background::color',
        'login::signup',
        'login::forgot',
        'login::username'
    ]);

    loginLogo.value = config['login::logo'];

    loginName.value = config['login::name'];

    const channel = new BroadcastChannel('cloudtak');
    channel.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const msg = event.data;
        if (msg && msg.type === WorkerMessageType.Mission_Invite) {
            inviteMission.value = msg.body;
        } else if (msg && msg.type === WorkerMessageType.Channel_Change) {
            channelChange.value = true;
        }
    };

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

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(async (registrations) => {
            for (const registration of registrations) {
                registration.update().catch((err) => {
                    console.debug('Failed to update ServiceWorker (likely unregistered):', err);
                });
            }

            try {
                for (const reg of registrations) {
                    const worker = reg.active;
                    if (worker?.scriptURL) {
                        const u = new URL(worker.scriptURL);
                        const swBuild = u.searchParams.get('build');
                        const swVersion = u.searchParams.get('v');
                        if (swBuild && swBuild !== import.meta.env.HASH) {
                            updatedSW.value = { version: swVersion, build: swBuild };
                            updateAvailable.value = true;
                        }
                        break;
                    }
                }
            } catch { /* ignore */ }
        });

        window.addEventListener('sw:updated', onSwUpdated);
    }

    loading.value = false;
    mounted.value = true;
});

onUnmounted(() => {
    window.removeEventListener('sw:updated', onSwUpdated);
});

function logout() {
    user.value = false;
    mapStore.tokenExpiry = null;
    delete localStorage.token;

    window.location.href = '/login';
}

function external(url: string) {
    window.location.href = url;
}

function routeLogin() {
    if (router.hasRoute('login')) {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    } else {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
}

async function refreshLogin() {
    loading.value = true;

    await checkToken();

    loading.value = false;
}

async function checkToken() {
    try {
        const token = localStorage.token;
        if (!token) throw new Error('No token found');
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expirationDate = payload.exp * 1000; // Convert to milliseconds
        mapStore.tokenExpiry = expirationDate;
        const now = Date.now();

        if (now > expirationDate) {
            throw new Error('Token expired');
        }
    } catch (err) {
        console.error(err);
        mapStore.tokenExpiry = null;

        logout();
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

.bg-accent {
    background-color: #283547 !important;
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
.btn-check:checked + .btn:hover {
    background-color: var(--tblr-primary) !important;
    border-color: var(--tblr-primary) !important;
    color: white !important;
}
</style>
