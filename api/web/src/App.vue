<template>
    <div
        class='page h-100'
        :class='appStore.resolvedTheme === "dark" ? "cloudtak-gradient" : "cloudtak-gradient-light"'
        :data-bs-theme='appStore.resolvedTheme'
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
                        :src='appStore.loginLogo || "/CloudTAKLogo.svg"'
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
                        v-text='appStore.loginName || ""'
                    />
                    <h2 class='page-title'>
                        CloudTAK
                    </h2>
                </div>

                <div
                    v-if='appStore.user'
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
                                    @click='appStore.logout'
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
            v-if='!mounted || (appStore.loading && !route.path.includes("configure") && !route.path.includes("login"))'
            :stage='appStore.loadingStage'
        />
        <router-view
            v-else
            @err='error = $event'
            @login='appStore.refreshLogin'
        />
        <TablerError
            v-if='error'
            :err='error'
            @close='error = undefined'
        />
        <ChannelChangeModal
            v-if='mapStore.channelChange'
            @close='mapStore.channelChange = false'
        />
        <NotificationToast
            v-for='n in toastNotifications'
            :id='n.id'
            :key='n.id'
            @close='TAKNotification.update(n.id, { toast: false })'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onErrorCaptured, onMounted, onUnmounted } from 'vue'
import { liveQuery } from 'dexie';
import { isTransientDbError } from './database.ts';
import { useRoute } from 'vue-router';
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
import Loading from './components/Loading.vue';
import {
    TablerBadge,
    TablerError
} from '@tak-ps/vue-tabler';
import ChannelChangeModal from './components/CloudTAK/Menu/ChannelChangeModal.vue';
import NotificationToast from './components/CloudTAK/util/NotificationToast.vue';
import TAKNotification_ from './base/notification.ts';
const TAKNotification = TAKNotification_;
import { supportsServiceWorker } from './base/capacitor.ts';
import { useObservable } from '@vueuse/rxjs';
import { from } from 'rxjs';
import { getPageServiceWorkerBuildId, markUpdateRequestedByThisTab } from './base/service-worker.ts';

import { useAppStore } from './stores/app.ts';
import { useMapStore } from './stores/map.ts';

const route = useRoute();

const appStore = useAppStore();
const mapStore = useMapStore();

const toastNotifications = useObservable(
    from(liveQuery(async () => {
        return (await TAKNotification.list()).filter((n) => n.toast && !n.read);
    }))
);
const updateAvailable = ref(false);
const pendingRegistration = ref<ServiceWorkerRegistration | null>(null);

const applyUpdate = () => {
    const waiting = pendingRegistration.value?.waiting;
    if (waiting) {
        // Tell service-worker.ts that THIS tab initiated the update, so its
        // controllerchange handler auto-reloads us. Other tabs will see the
        // same controllerchange, not find this flag, and surface their own
        // prompt instead of silently reloading.
        markUpdateRequestedByThisTab();
        waiting.postMessage('SKIP_WAITING');
    } else {
        window.location.reload();
    }
};

const onSwUpdateAvailable = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    pendingRegistration.value = detail.registration;
    updateAvailable.value = true;
};

const mounted = ref(false);
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
    const e = err instanceof Error ? err : new Error(String(err));

    if (isTransientDbError(e)) {
        return false;
    }

    if (e.message === '401') {
        // Popup Modal if reauthenticating vs initial login

        if (route.name !== 'login') {
            appStore.routeLogin();
        }
    } else if (String(e) === 'Error: Authentication Required') {
        appStore.routeLogin();
    } else {
        error.value = e;
    }
});

onMounted(async () => {
    // Always clear the loading splash, even if initialization throws (e.g. a
    // request times out on a native cold-start). Otherwise the app can get
    // permanently stuck on the loading component before the login page.

    // Register before any awaits so early promise rejections are captured
    window.addEventListener('unhandledrejection', (e) => {
        const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
        if (isTransientDbError(err)) {
            return;
        }
        error.value = err;
    });

    if (supportsServiceWorker()) {
        window.addEventListener('sw:update-available', onSwUpdateAvailable);
    }

    let completed = false;
    try {
        completed = await appStore.bootstrap();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        appStore.loading = false;
        mounted.value = true;
    }

    if (completed) {
        checkServiceWorkerUpdates();
    }
});

function checkServiceWorkerUpdates(): void {
    appStore.loadingStage = 'Checking for updates…';

    if (!supportsServiceWorker()) return;

    navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        const currentBuildId = getPageServiceWorkerBuildId();

        for (const registration of registrations) {
            registration.update().catch((err) => {
                console.debug('Failed to update ServiceWorker (likely unregistered):', err);
            });
        }

        try {
            for (const reg of registrations) {
                // Prefer a waiting worker (new version ready to activate)
                if (reg.waiting) {
                    pendingRegistration.value = reg;
                    updateAvailable.value = true;
                    break;
                }

                // Fall back to detecting an active SW whose build differs from
                // the currently loaded page (e.g. another tab triggered activation).
                //
                // IMPORTANT: only compare build fingerprints, not the `?v=`
                // package.json version param. The `?v=` value is whatever
                // `package.json` happened to be when the *previous* page
                // called `register()` for this worker, not what is actually
                // deployed. After a SKIP_WAITING + auto-reload, the freshly
                // loaded page imports a *newer* `package.json` than the
                // value baked into `reg.active.scriptURL`, so a version
                // comparison spuriously re-shows the update banner with no
                // pending worker present. The build fingerprint is derived
                // from deployed asset filenames and is the source of truth.
                const worker = reg.active;
                if (worker?.scriptURL) {
                    const u = new URL(worker.scriptURL);
                    const swBuild = u.searchParams.get('build');
                    if (currentBuildId && swBuild && swBuild !== currentBuildId) {
                        updateAvailable.value = true;
                    }
                    break;
                }
            }
        } catch { /* ignore */ }
    });
}

onUnmounted(() => {
    window.removeEventListener('sw:update-available', onSwUpdateAvailable);
    appStore.teardown();
});

function external(url: string) {
    window.location.href = url;
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
