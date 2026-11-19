<template>
    <div class='d-flex flex-column align-items-center'>
        <div
            :title='statusTitle'
            class='position-relative cursor-pointer cloudtak-hover'
            role='button'
            tabindex='0'
            :aria-label='statusLabel'
            @click='handleHomeClick'
            @keyup.enter='handleHomeClick'
        >
            <img
                :src='logo'
                :height='props.size'
                :width='props.size'
                alt='Server Logo'
            >
            <div
                class='server-status-dot position-absolute'
                :class='`status-${status}`'
            />
        </div>
        <div
            v-if='props.version'
            class='subheader text-white mt-1'
            v-text='serverVersion'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMapStore } from '../../stores/map.ts';
import { useSharingStore } from '../../stores/sharing.ts';
import { supportsServiceWorker } from '../../utils/capacitor.ts';
import Config from '../../base/config.ts';
import { connectionState } from '../../utils/connection-state.ts';

const props = defineProps<{
    version?: boolean;
    size?: number;
}>();

const router = useRouter();
const mapStore = useMapStore();
const sharing = useSharingStore();

// Ticks while the connection is down, so "reconnecting" turns into "disconnected"
// once it has gone on too long without anything else changing
const now = ref(Date.now());
const mountedAt = Date.now();
let ticker: ReturnType<typeof setInterval> | undefined;

const status = computed(() => connectionState({
    paused: sharing.paused,
    isOpen: mapStore.isOpen,
    isOnline: mapStore.isOnline,
    closedAt: mapStore.connectionClosedAt ?? (mapStore.isOpen ? null : mountedAt),
    now: now.value
}));

const statusText = computed(() => ({
    paused: 'sharing paused',
    connected: 'connected',
    reconnecting: 'reconnecting',
    disconnected: 'disconnected'
}[status.value]));
const statusTitle = computed(() => `Return Home (${statusText.value})`);
const statusLabel = computed(() => `Return Home. Server ${statusText.value}`);

watch(status, (value) => {
    if (value === 'reconnecting' && !ticker) {
        ticker = setInterval(() => { now.value = Date.now(); }, 5000);
    } else if (value !== 'reconnecting' && ticker) {
        clearInterval(ticker);
        ticker = undefined;
    }
    now.value = Date.now();
}, { immediate: true });

const logo = ref('/CloudTAKLogo.svg');
const serverVersion = ref('');

let alive = false;
onMounted(() => { alive = true; });
onUnmounted(() => {
    alive = false;
    if (ticker) clearInterval(ticker);
});

onMounted(async () => {
    const loginConfig = await Config.list(['login::logo']);
    if (!alive) return;

    const loginLogo = loginConfig['login::logo'];
    if (typeof loginLogo === 'string' && loginLogo) {
        logo.value = loginLogo;
    }

    if (supportsServiceWorker()) {
        const pkg = await navigator.serviceWorker.getRegistration();
        if (pkg && pkg.active) {
            const url = new URL(pkg.active.scriptURL);
            if (alive && url.searchParams.get('v')) {
                serverVersion.value = String(url.searchParams.get('v'));
            }
        }
    }

    if (alive && !serverVersion.value) {
        serverVersion.value = (await mapStore.worker.profile.loadServer()).version;
    }
});

function handleHomeClick() {
    router.push('/');
    mapStore.returnHome();
}
</script>

<style scoped>
.server-status-dot {
    height: 12px;
    width: 12px;
    bottom: 2px;
    right: 2px;
    border-radius: 50%;
}

.status-connected {
    background-color: #2fb344;
}
.status-disconnected {
    background-color: #d63939;
}
/* Closed, but the app is reconnecting by itself: pulsing orange instead of a red alarm */
.status-reconnecting {
    background-color: #f59f00;
    animation: status-pulse 1.1s ease-in-out infinite;
}
@keyframes status-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.75); }
}
@media (prefers-reduced-motion: reduce) {
    .status-reconnecting {
        animation: none;
    }
}
/* Paused by the user: a ring, not a solid dot, so it is not told apart by colour alone */
.status-paused {
    background-color: #fff;
    border: 3px solid #6c757d;
    box-sizing: border-box;
}
</style>
