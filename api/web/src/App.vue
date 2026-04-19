<template>
    <div
        class='page h-100'
        :class='resolvedTheme === "dark" ? "cloudtak-gradient" : "cloudtak-gradient-light"'
        :data-bs-theme='resolvedTheme'
        data-bs-theme-base='neutral'
        data-bs-theme-primary='blue'
    >
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
                                    class='d-flex dropdown-item cursor-pointer cloudtak-hover'
                                    @click='external("/connection")'
                                >
                                    <IconNetwork
                                        size='32'
                                        stroke='1'
                                    />
                                    <span class='mx-2'>Connections</span>
                                </div>
                                <div
                                    class='d-flex dropdown-item cursor-pointer cloudtak-hover'
                                    @click='external("/admin")'
                                >
                                    <IconSettings
                                        size='32'
                                        stroke='1'
                                    />
                                    <span class='mx-2'>Admin</span>
                                    <TablerBadge
                                        class='ms-auto'
                                        background-color='rgba(239, 68, 68, 0.2)'
                                        border-color='rgba(239, 68, 68, 0.5)'
                                        text-color='#dc2626'
                                    >
                                        Admin
                                    </TablerBadge>
                                </div>
                                <div
                                    class='d-flex dropdown-item cursor-pointer cloudtak-hover'
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
import { liveQuery, type Subscription } from 'dexie';
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
    TablerBadge,
    TablerError
} from '@tak-ps/vue-tabler';
import MissionInviteModal from './components/CloudTAK/Menu/Mission/MissionInviteModal.vue';
import ChannelChangeModal from './components/CloudTAK/Menu/ChannelChangeModal.vue';
import { WorkerMessageType } from './base/events.ts';
import type { WorkerMessage } from './base/events.ts';
import { db } from './base/database.ts';
import { getCurrentEntryBuildId } from './base/service-worker.ts';
import { useMapStore } from './stores/map.ts';

const router = useRouter();
const route = useRoute();
const mapStore = useMapStore();
const currentBuildId = getCurrentEntryBuildId();

const loginLogo = ref<string>();
const loginName = ref<string>();

const updateAvailable = ref(false);
const updatedSW = ref<{ version: string | null; build: string | null }>({ version: null, build: null });
const pendingRegistration = ref<ServiceWorkerRegistration | null>(null);

const applyUpdate = () => {
    const waiting = pendingRegistration.value?.waiting;
    if (waiting) {
        waiting.postMessage('SKIP_WAITING');
        // controllerchange handler in main.ts will reload the page
    } else {
        window.location.reload();
    }
};

const onSwUpdateAvailable = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    updatedSW.value = {
        version: detail.version,
        build: detail.build
    };
    pendingRegistration.value = detail.registration;
    updateAvailable.value = true;
};

type DisplayStyleMode = 'System Default' | 'Light' | 'Dark';
type ResolvedThemeMode = 'light' | 'dark';

const loading = ref(true);
const resolvedTheme = ref<ResolvedThemeMode>('dark');
const displayStyle = ref<DisplayStyleMode>('System Default');
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

let displayStyleSub: Subscription | undefined;
const systemThemeQuery = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : undefined;

function resolveTheme(style: string | undefined): ResolvedThemeMode {
    if (style === 'Light') return 'light';
    if (style === 'Dark') return 'dark';
    return systemThemeQuery?.matches ? 'dark' : 'light';
}

function applyTheme(style: string | undefined = displayStyle.value): void {
    const theme = resolveTheme(style);
    resolvedTheme.value = theme;

    document.documentElement.setAttribute('data-bs-theme', theme);
    document.documentElement.setAttribute('data-bs-theme-base', 'neutral');
    document.documentElement.setAttribute('data-bs-theme-primary', 'blue');
}

function onSystemThemeChange(): void {
    if (displayStyle.value === 'System Default') {
        applyTheme(displayStyle.value);
    }
}

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

    if ('serviceWorker' in navigator) {
        window.addEventListener('sw:update-available', onSwUpdateAvailable);
    }

    applyTheme();
    displayStyleSub = liveQuery(() => db.profile.get('display_style')).subscribe((entry) => {
        const style = entry?.value;
        displayStyle.value = style === 'Light' || style === 'Dark' ? style : 'System Default';
        applyTheme(displayStyle.value);
    });
    systemThemeQuery?.addEventListener('change', onSystemThemeChange);

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
                    // Prefer a waiting worker (new version ready to activate)
                    if (reg.waiting) {
                        const u = new URL(reg.waiting.scriptURL);
                        updatedSW.value = {
                            version: u.searchParams.get('v'),
                            build: u.searchParams.get('build')
                        };
                        pendingRegistration.value = reg;
                        updateAvailable.value = true;
                        break;
                    }

                    // Fall back to detecting an active SW whose build differs from
                    // the currently loaded page (e.g. another tab triggered activation).
                    const worker = reg.active;
                    if (worker?.scriptURL) {
                        const u = new URL(worker.scriptURL);
                        const swBuild = u.searchParams.get('build');
                        const swVersion = u.searchParams.get('v');
                        if ((swVersion && swVersion !== version) || (swBuild && swBuild !== currentBuildId)) {
                            updatedSW.value = { version: swVersion, build: swBuild };
                            updateAvailable.value = true;
                        }
                        break;
                    }
                }
            } catch { /* ignore */ }
        });
    }

    loading.value = false;
    mounted.value = true;
});

onUnmounted(() => {
    window.removeEventListener('sw:update-available', onSwUpdateAvailable);
    systemThemeQuery?.removeEventListener('change', onSystemThemeChange);
    displayStyleSub?.unsubscribe();
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

:root {
    --cloudtak-light: rgba(var(--tblr-primary-rgb), 0.08);
}

.cloudtak-gradient {
    background: radial-gradient(at left top, $cloudtak-blue, $cloudtak-navy);
}

.cloudtak-gradient-light {
    background: radial-gradient(at left top, #f7fbff, #dde8f4);
}

.btn-primary {
    background-color: $cloudtak-blue !important;
}

html[data-bs-theme='dark'] {
    --tabler-input-bg: var(--tblr-bg-forms, var(--tblr-bg-surface, var(--tblr-body-bg)));
}

html[data-bs-theme='light'] {
    --tabler-input-bg: var(--cloudtak-light);
}

html[data-bs-theme='dark'] .cloudtak-accent {
    background-color: #192f45 !important;
    border-color: rgba(255, 255, 255, 0.14) !important;
    box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.06);
}

html[data-bs-theme='light'] .cloudtak-accent {
    background-color: var(--tblr-primary-lt) !important;
}

html[data-bs-theme='light'] .cloudtak-accent.text-white {
    color: var(--tblr-body-color) !important;
}

html[data-bs-theme='dark'] .cloudtak-bg {
    background-color: #283547 !important;
}

html[data-bs-theme='light'] .cloudtak-bg {
    background-color: var(--tblr-light) !important;
    color: var(--tblr-body-color);
}

html[data-bs-theme='light'] .cloudtak-bg.text-white {
    color: var(--tblr-body-color) !important;
}

html[data-bs-theme='light'] .cloudtak-bg .text-white:not(.badge):not(.btn):not([class*='bg-']),
html[data-bs-theme='light'] .cloudtak-accent .text-white:not(.badge):not(.btn):not([class*='bg-']) {
    color: var(--tblr-body-color) !important;
}

html[data-bs-theme='light'] .cloudtak-bg .text-white-50:not(.badge):not(.btn):not([class*='bg-']),
html[data-bs-theme='light'] .cloudtak-accent .text-white-50:not(.badge):not(.btn):not([class*='bg-']) {
    color: var(--tblr-secondary-color) !important;
}

.bg-child {
    background-color: $cloudtak-child !important;
}

.cloudtak-hover {
    border: 1px solid transparent;
    transition: background-color 0.15s ease, border-color 0.15s ease;
}

html[data-bs-theme='dark'] .cloudtak-hover:hover,
html[data-bs-theme='dark'] .cloudtak-hover:focus-visible,
html[data-bs-theme='dark'] .cloudtak-hover:focus-within {
    border-radius: 6px;
    border-color: color-mix(in srgb, var(--tblr-light) 30%, transparent);
    background: color-mix(in srgb, var(--tblr-light) 12%, transparent);
}

html[data-bs-theme='light'] .cloudtak-hover:hover,
html[data-bs-theme='light'] .cloudtak-hover:focus-visible,
html[data-bs-theme='light'] .cloudtak-hover:focus-within {
    border-radius: 6px;
    border-color: color-mix(in srgb, var(--tblr-body-color) 18%, transparent);
    background: color-mix(in srgb, var(--tblr-body-color) 8%, transparent);
}

html[data-bs-theme='dark'] .cloudtak-accent.cloudtak-hover:hover,
html[data-bs-theme='dark'] .cloudtak-accent.cloudtak-hover:focus-visible,
html[data-bs-theme='dark'] .cloudtak-accent.cloudtak-hover:focus-within {
    background-color: color-mix(in srgb, #192f45 82%, white 18%) !important;
}

html[data-bs-theme='light'] .cloudtak-accent.cloudtak-hover:hover,
html[data-bs-theme='light'] .cloudtak-accent.cloudtak-hover:focus-visible,
html[data-bs-theme='light'] .cloudtak-accent.cloudtak-hover:focus-within {
    background-color: color-mix(in srgb, var(--tblr-primary-lt) 82%, var(--tblr-body-color) 18%) !important;
}

.cloudtak-hover-hidden {
    visibility: hidden;
}

.cloudtak-hover:hover .cloudtak-hover-hidden,
.cloudtak-hover:focus-within .cloudtak-hover-hidden {
    visibility: visible;
}

.border-light {
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
