<template>
    <div
        class='page page-center cloudtak-gradient position-relative'
        style='overflow: auto;'
    >
        <div
            v-if='customBackgroundColor'
            class='position-absolute w-100 h-100 top-0 start-0 bg-fade-enter'
            style='z-index: 0;'
            :style='{ backgroundColor: customBackgroundColor }'
        />

        <img
            v-if='brandStore.loaded && footerLogo'
            class='position-absolute d-none d-md-inline user-select-none'
            :class='{ "logo-visible": footerLogoLoaded }'
            draggable='false'
            style='
                height: 48px;
                bottom: 24px;
                left: 24px;
                opacity: 0;
                transition: opacity 0.8s ease-in-out;
                z-index: 1;
            '
            :src='footerLogo'
            alt='CloudTAK Logo'
            @load='footerLogoLoaded = true'
        >

        <div
            class='container container-normal py-4 position-relative'
            style='z-index: 1;'
        >
            <div class='row align-items-center g-4'>
                <div class='col-lg'>
                    <div class='container-tight'>
                        <div class='card card-md'>
                            <div
                                v-if='!brandStore || !brandStore.loaded'
                                class='card-body d-flex align-items-center justify-content-center'
                                style='height: 400px;'
                            >
                                <TablerLoading />
                            </div>
                            <div
                                v-else
                                class='card-body'
                            >
                                <div
                                    class='text-center'
                                    style='margin-bottom: 24px;'
                                >
                                    <img
                                        :src='brandStore.login && brandStore.login.logo ? brandStore.login.logo : "/CloudTAKLogo.svg"'
                                        style='height: 150px;'
                                        draggable='false'
                                        class='user-select-none'
                                        alt='CloudTAK System Logo'
                                    >
                                </div>
                                <h2 class='h2 text-center mb-4'>
                                    Login to your account
                                </h2>
                                <TablerInlineAlert
                                    v-if='ssoError && !loading'
                                    class='mb-3'
                                    title='SSO Login Failed'
                                    :description='ssoError'
                                    severity='danger'
                                />
                                <TablerLoading
                                    v-if='loading'
                                    :desc='loadingMessage'
                                />
                                <template v-else-if='albOidcEnabled && albOidcForced && !route.query.local'>
                                    <div class='text-center text-muted py-3'>
                                        <div class='mb-2'>
                                            <IconLock
                                                :size='32'
                                                stroke='1.5'
                                            />
                                        </div>
                                        <p class='mb-0'>
                                            This instance only supports Single Sign-On (SSO). Please use the SSO login button below.
                                        </p>
                                    </div>
                                </template>
                                <template v-else>
                                    <div class='mb-3'>
                                        <template v-if='storedUsername'>
                                            <label class='form-label'>
                                                {{ brandStore.login?.username || "Username or Email" }}
                                            </label>
                                            <div class='d-flex align-items-center justify-content-between border rounded px-3 py-2'>
                                                <div class='d-flex align-items-center text-truncate'>
                                                    <IconUser
                                                        :size='20'
                                                        stroke='1.5'
                                                        class='me-2 text-muted flex-shrink-0'
                                                    />
                                                    <span class='text-truncate'>{{ storedUsername }}</span>
                                                </div>
                                                <button
                                                    type='button'
                                                    class='btn btn-sm btn-link text-decoration-none flex-shrink-0 ms-2'
                                                    @click='notMe'
                                                >
                                                    Not Me
                                                </button>
                                            </div>
                                        </template>
                                        <TablerInput
                                            v-else
                                            v-model='body.username'
                                            icon='user'
                                            :label='brandStore.login?.username || "Username or Email"'
                                            :placeholder='brandStore.login?.username || "your@email.com"'
                                            autocomplete='username webauthn'
                                            @keyup.enter='createLogin'
                                        />
                                    </div>
                                    <div class='mb-2'>
                                        <div class='d-flex'>
                                            <label class='form-label mb-0'>
                                                Password
                                            </label>
                                            <span class='ms-auto'>
                                                <a
                                                    v-if='brandStore.login && brandStore.login.forgot'
                                                    tabindex='-1'
                                                    class='cursor-pointer'
                                                    :href='brandStore.login.forgot'
                                                >Forgot Password</a>
                                            </span>
                                        </div>
                                        <TablerInput
                                            v-model='body.password'
                                            icon='lock'
                                            type='password'
                                            placeholder='Your password'
                                            @keyup.enter='createLogin'
                                        />
                                    </div>
                                    <div class='form-footer'>
                                        <button
                                            type='submit'
                                            class='btn btn-primary w-100'
                                            @click='createLogin'
                                        >
                                            Sign In
                                        </button>
                                    </div>
                                </template>
                                <template v-if='albOidcEnabled && !loading'>
                                    <div
                                        v-if='!albOidcForced || route.query.local'
                                        class='my-3 d-flex align-items-center'
                                    >
                                        <hr class='flex-grow-1 m-0'>
                                        <span class='mx-2 text-muted small'>or</span>
                                        <hr class='flex-grow-1 m-0'>
                                    </div>
                                    <button
                                        type='button'
                                        class='btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2'
                                        @click='loginWithSSO'
                                    >
                                        <IconKey
                                            :size='20'
                                            stroke='1.5'
                                        />
                                        Login with SSO
                                    </button>
                                </template>
                                <template v-if='brandStore.passkey.enabled && !loading && !albOidcEnabled && !isNativePlatform()'>
                                    <div class='my-3 d-flex align-items-center'>
                                        <hr class='flex-grow-1 m-0'>
                                        <span class='mx-2 text-muted small'>or</span>
                                        <hr class='flex-grow-1 m-0'>
                                    </div>
                                    <button
                                        type='button'
                                        class='btn btn-secondary w-100 d-flex align-items-center justify-content-center gap-2'
                                        @click='authenticatePasskey'
                                    >
                                        <IconFingerprint
                                            :size='20'
                                            stroke='1.5'
                                        />
                                        Sign in with Passkey
                                    </button>
                                </template>
                                <template v-if='certRenewal.required && !loading'>
                                    <TablerInlineAlert
                                        class='mt-3 mb-2'
                                        title='Certificate Renewal Required'
                                        :description='certRenewal.expired
                                            ? "Your TAK certificate is expired or no longer valid. Please enter your password to issue a new one."
                                            : "Your TAK certificate is expiring soon. Please enter your password to renew it."'
                                        :severity='certRenewal.expired ? "danger" : "warning"'
                                    />
                                    <div class='mb-3'>
                                        <TablerInput
                                            v-model='certRenewal.password'
                                            icon='lock'
                                            type='password'
                                            label='Password'
                                            placeholder='Enter your password'
                                            @keyup.enter='renewCertificate'
                                        />
                                    </div>
                                    <div class='d-flex gap-2'>
                                        <button
                                            type='button'
                                            class='btn btn-primary flex-fill'
                                            @click='renewCertificate'
                                        >
                                            Renew Certificate
                                        </button>
                                        <button
                                            v-if='!certRenewal.expired'
                                            type='button'
                                            class='btn btn-secondary'
                                            @click='skipCertRenewal'
                                        >
                                            Skip
                                        </button>
                                    </div>
                                </template>
                            </div>
                        </div>
                        <div
                            v-if='brandStore.login && brandStore.login.signup'
                            class='text-center text-muted mt-3'
                        >
                            Don't have an account yet?
                            <a
                                tabindex='-1'
                                class='cursor-pointer'
                                :href='brandStore.login.signup'
                            >Sign Up</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div
            class='dropup position-absolute'
            style='bottom: 24px; right: 24px; z-index: 20;'
        >
            <div
                class='cursor-pointer'
                @click='showSettings = !showSettings'
            >
                <IconSettings class='text-secondary' />
            </div>

            <div
                v-if='showSettings'
                class='dropdown-menu dropdown-menu-card show dropdown-menu-end p-0 shadow'
                style='min-width: 300px; bottom: 100% !important; top: auto !important; right: 0 !important; left: auto !important;'
            >
                <div class='card'>
                    <div class='card-header'>
                        <h3 class='card-title'>
                            Login Settings
                        </h3>
                        <div class='card-actions'>
                            <button
                                class='btn-close'
                                @click.stop='showSettings = false'
                            />
                        </div>
                    </div>
                    <div class='card-body p-0'>
                        <div
                            v-if='isNativePlatform()'
                            class='px-3 pt-2 pb-2 border-bottom'
                        >
                            <button
                                class='btn btn-sm btn-outline-secondary w-100'
                                @click='switchServers'
                            >
                                Switch Servers
                            </button>
                        </div>
                        <div class='px-3 pt-2 pb-1 border-bottom'>
                            <span class='text-muted small'>Running </span>
                            <code class='small'>v{{ version }}</code>
                            <span class='text-muted small'> (build: {{ buildHash }})</span>
                        </div>
                        <div
                            v-if='workers.length === 0'
                            class='p-3 text-muted text-center'
                        >
                            No Service Workers Found
                        </div>
                        <div
                            v-else
                            class='list-group list-group-flush'
                        >
                            <div
                                v-for='w in workers'
                                :key='w.url'
                                class='list-group-item'
                            >
                                <div class='d-flex justify-content-between align-items-center'>
                                    <div
                                        class='text-truncate me-2'
                                        title='Service Worker'
                                    >
                                        <div class='fw-bold'>
                                            {{ w.url }}
                                        </div>
                                        <div class='mt-1 d-flex align-items-center gap-2'>
                                            <TablerBadge
                                                background-color='rgba(34, 197, 94, 0.2)'
                                                border-color='rgba(34, 197, 94, 0.5)'
                                                text-color='#16a34a'
                                            >
                                                {{ w.state }}
                                            </TablerBadge>
                                            <div
                                                v-if='w.version'
                                                class='text-muted small'
                                            >
                                                v{{ w.version }}
                                            </div>
                                            <div
                                                v-if='w.build'
                                                class='text-muted small'
                                            >
                                                {{ w.build }}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        class='btn btn-icon btn-ghost-danger btn-sm'
                                        title='Unregister'
                                        @click='unregister(w.registration)'
                                    >
                                        <IconTrash size='16' />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import type { Login_Create, ConfigLogin } from '../types.ts'
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue';
import { version } from '../../package.json';
import { IconSettings, IconTrash, IconLock, IconFingerprint, IconUser, IconKey } from '@tabler/icons-vue';
import { Preferences } from '@capacitor/preferences';
import { startAuthentication, WebAuthnAbortService } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON, AuthenticationResponseJSON } from '@simplewebauthn/browser';
import Config from '../base/config.ts';
import type { FullConfig } from '../base/config.ts';
import { isNativePlatform, supportsServiceWorker } from '../utils/capacitor.ts';
import { getCurrentEntryBuildId } from '../utils/service-worker.ts';
import { useRouter, useRoute } from 'vue-router'
import { server, stdurl } from '../std.ts';
import { startNativeSSO, completeNativeSSO, cancelNativeSSO, closeSSOBrowser, listenForSSOCallback } from '../utils/native-sso.ts';
import type { SSOCallback } from '../utils/native-sso.ts';
import { useAppStore } from '../stores/app.ts';
import {
    TablerBadge,
    TablerLoading,
    TablerInput,
    TablerInlineAlert
} from '@tak-ps/vue-tabler'

const route = useRoute();
const router = useRouter();

const appStore = useAppStore();

const brandStore = reactive<{
    loaded: boolean;
    login: ConfigLogin | undefined;
    passkey: {
        enabled: boolean;
    };
}>({
    loaded: false,
    login: undefined,
    passkey: {
        enabled: true,
    },
});

const footerLogoLoaded = ref(false);

const customBackgroundColor = computed(() => {
    if (brandStore.login?.background?.enabled && brandStore.login.background.color) {
        return brandStore.login.background.color;
    }
    return null;
});

const footerLogo = computed(() => {
    if (!brandStore.login) return undefined;

    if (brandStore.login.brand?.enabled === 'disabled') {
        return undefined;
    } else if (brandStore.login.brand?.logo) {
        return brandStore.login.brand.logo;
    } else {
        return '/CloudTAKLogoText.svg';
    }
});

const buildHash = getCurrentEntryBuildId();

const showSettings = ref(false);
const workers = ref<{
    url: string;
    state: string;
    version?: string | null;
    build?: string | null;
    registration: ServiceWorkerRegistration
}[]>([]);

const fetchWorkers = async () => {
    if (!supportsServiceWorker()) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    workers.value = registrations.map(r => {
        const worker = r.active || r.waiting || r.installing;
        const scriptURL = worker?.scriptURL;

        let url = 'Unknown';
        let version: string | null = null;
        let build: string | null = null;

        if (scriptURL) {
            try {
                const u = new URL(scriptURL);
                url = u.origin + u.pathname;
                version = u.searchParams.get('v');
                build = u.searchParams.get('build');
            } catch {
                url = scriptURL;
            }
        }

        return {
            url,
            state: worker?.state || 'Unknown',
            version,
            build,
            registration: r
        }
    });
}

const unregister = async (r: ServiceWorkerRegistration) => {
    await r.unregister();
    await fetchWorkers();
}

async function switchServers(): Promise<void> {
    await appStore.destroySession();
    await Preferences.remove({ key: 'serverUrl' });
    window.location.href = '/setup.html';
}

watch(showSettings, (val) => {
    if (val) fetchWorkers();
});

const loading = ref(false);
const loadingMessage = ref('Logging in');
const albOidcEnabled = ref(false);
const albOidcForced = ref(false);
const storedUsername = ref<string | null>(null);
// Populated from `?sso_error=` on mount (see below) - the backend redirects
// here with this set whenever an SSO login fails, or is rejected for an
// account restricted to local login.
const ssoError = ref<string | null>(null);
const body = ref<Login_Create>({
    username: '',
    password: ''
});
const certRenewal = reactive<{
    required: boolean;
    expired: boolean;
    email: string;
    password: string;
}>({
    required: false,
    expired: false,
    email: '',
    password: '',
});

// TAK-NZ: no `oidc::*` keys - SSO is driven by GET /api/server/oidc below
const configKeys: (keyof FullConfig)[] = [
    'login::name',
    'login::logo',
    'login::signup',
    'login::forgot',
    'login::username',
    'login::brand::enabled',
    'login::brand::logo',
    'login::background::enabled',
    'login::background::color',
    'passkey::enabled' as keyof FullConfig,
];

let passkeyStarted = false;
// Set once GET /api/server/oidc has answered - conditional passkey autofill is
// deliberately held back until then so it stays suppressed while SSO is active.
let oidcStatusKnown = false;

function applyConfig(config: Partial<FullConfig>): void {
    brandStore.login = {
        name: config['login::name'],
        logo: config['login::logo'],
        signup: config['login::signup'],
        forgot: config['login::forgot'],
        username: config['login::username'] || 'Username or Email',
        brand: {
            enabled: config['login::brand::enabled'] as "default" | "enabled" | "disabled" || 'default',
            logo: config['login::brand::logo']
        },
        background: {
            enabled: config['login::background::enabled'] === true,
            color: config['login::background::color']
        }
    };
    brandStore.passkey.enabled = (config as Record<string, unknown>)['passkey::enabled'] !== false;
    brandStore.loaded = true;

    // NOTE: upstream calls startConditionalPasskey() as soon as the config
    // loads. We deliberately hold it back until the SSO status is known (see
    // startPasskeyIfAllowed), so passkey conditional mediation stays suppressed
    // while SSO is active.
    if (brandStore.passkey.enabled && oidcStatusKnown) startPasskeyIfAllowed();
}

function startPasskeyIfAllowed(): void {
    if (brandStore.passkey.enabled && !albOidcEnabled.value && !isNativePlatform() && !passkeyStarted) {
        passkeyStarted = true;
        startConditionalPasskey();
    }
}

// Removes the native SSO callback listener (see handleSSOCallback)
let removeSSOListener: (() => void) | undefined;
onMounted(async () => {
    // The native app finishes an SSO login in the system browser and is reopened
    // through its URL scheme, so listen before anything below can return early
    if (isNativePlatform()) {
        try {
            removeSSOListener = await listenForSSOCallback((callback) => { void handleSSOCallback(callback); });
        } catch (err) {
            console.error('Failed to listen for the SSO callback', err);
        }
    }
    // Detect an existing (un-cleared) session left behind by a previous login.
    // This MUST run before any of the login-consuming branches below (ETL
    // token, OIDC fragment, query-string token) - those branches call
    // applySession()/persistSession(), which compares the newly-authenticated
    // user against storedUsername to decide whether to wipe locally cached
    // data from a different user. If this check ran after those branches
    // instead, storedUsername would still be null at comparison time, so a
    // browser previously used for one account could silently inherit that
    // account's cached profile/WebSocket state when a different user logs in
    // via SSO. The database is intentionally NOT deleted here - it is only
    // cleared on an explicit sign-out or when a different user logs in via
    // applySession()/destroySession(). This avoids a costly resync when a
    // token simply expires.
    try {
        const existing = await appStore.getUsername();
        if (existing) {
            storedUsername.value = existing;
            body.value.username = existing;
        }
    } catch (err) {
        console.error('Failed to read existing session', err);
    }

    // Surface an SSO failure the backend redirected back with, instead of
    // discarding it. Read before the forced-SSO auto-redirect check below,
    // which also checks for it directly to decide whether to redirect again.
    if (typeof route.query.sso_error === 'string' && route.query.sso_error) {
        ssoError.value = route.query.sso_error;
    }

    // Handle SSO login completion. The backend hands the session back via a
    // URL Fragment (/login#sso=<base64url payload>) rather than a query
    // string, so it is never sent to the server or written to access logs.
    // Parse and clear the fragment immediately so it isn't left sitting in
    // the address bar or browser history.
    if (window.location.hash.startsWith('#sso=')) {
        loading.value = true;
        loadingMessage.value = 'Completing login...';
        const payloadRaw = window.location.hash.slice('#sso='.length);
        // Clear the fragment from the URL without triggering a navigation/reload.
        history.replaceState(null, '', window.location.pathname + window.location.search);
        try {
            const padded = payloadRaw + '='.repeat((4 - payloadRaw.length % 4) % 4);
            const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(json) as {
                token: string;
                refresh: string;
                email: string;
                session: string;
                redirect?: string;
            };
            await applySession({ token: payload.token, refresh: payload.refresh, email: payload.email, session: payload.session });
            if (!await settleSession()) return;
            const redirectPath = payload.redirect && payload.redirect.startsWith('/') ? payload.redirect : '/';
            await router.replace(redirectPath);
        } catch (err) {
            loading.value = false;
            console.error('Failed to parse SSO login payload', err);
            // Fall through to normal login form
        }
        return;
    }

    // Handle token passed back from ALB OIDC redirect (/api/login/oidc → /login?token=xxx)
    if (route.query.token) {
        loading.value = true;
        loadingMessage.value = 'Completing login...';
        const token = String(route.query.token);
        const redirectPath = route.query.redirect ? String(route.query.redirect) : '/';
        // Decode the JWT minimally to extract email and session for persistence
        try {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                if (payload.email && payload.s) {
                    await appStore.persistSession({ token, username: payload.email, session: payload.s });
                } else {
                    localStorage.token = token;
                }
            } else {
                localStorage.token = token;
            }
        } catch {
            localStorage.token = token;
        }
        if (!await settleSession()) return;
        await router.replace(redirectPath.startsWith('/') ? redirectPath : '/');
        return;
    }

    let config: Partial<FullConfig> = {};
    try {
        config = await Config.list(configKeys);
    } catch (err) {
        console.error('Failed to load login config, using defaults', err);
    }

    applyConfig(config);

    // Cached values may be stale - pick up server-side changes in the background
    Config.refresh(configKeys)
        .then((fresh) => applyConfig({ ...config, ...fresh }))
        .catch((err) => console.warn('Failed to refresh login config', err));

    // Check in-app OIDC status (env-var/CDK-driven, see GET /api/server/oidc).
    try {
        const oidcRes = await fetch(stdurl('/api/server/oidc'));
        if (oidcRes.ok) {
            const oidcStatus = await oidcRes.json() as { oidc_enabled: boolean; oidc_forced?: boolean };
            albOidcEnabled.value = oidcStatus.oidc_enabled;
            albOidcForced.value = oidcStatus.oidc_forced || false;
            // If SSO is forced and no explicit local-login override, redirect immediately
            // `sso_error` also suppresses the auto-redirect, not just `local` -
            // a backend redirect that forgot to set `local=true` alongside
            // `sso_error` (or a future one that does the same) would otherwise
            // send the browser straight back to SSO with no visible error and
            // no way out. See ssoError below for how the message is shown.
            // `signed_out` is set by the native app after logout, where the
            // IdP session was just ended and a redirect would loop back to it
            if (albOidcForced.value && !route.query.local && !route.query.sso_error && !route.query.signed_out) {
                loading.value = true;
                loadingMessage.value = 'Redirecting to SSO...';
                loginWithSSO();
                return;
            }
        }
    } catch (err) {
        console.error('Failed to check ALB OIDC status:', err);
    }

    // Only start conditional passkey autofill when SSO is not active
    oidcStatusKnown = true;
    startPasskeyIfAllowed();
});

// Clear the stored session and wipe the local database ("Not Me" button).
async function notMe(): Promise<void> {
    try {
        await appStore.destroySession();
    } catch (err) {
        console.error('Failed to clear existing session', err);
    }

    storedUsername.value = null;
    body.value.username = '';
    body.value.password = '';
}

// Persist a successful login, wiping the database first if a different user
// than the one cached locally is authenticating.
async function applySession(login: { token: string; refresh: string; email: string; session: string }): Promise<void> {
    if (storedUsername.value && storedUsername.value !== login.email) {
        await appStore.destroySession();
    }

    await appStore.persistSession({ token: login.token, refresh: login.refresh, username: login.email, session: login.session });
    storedUsername.value = login.email;
}

// Bring appStore's auth state in sync with the session we just persisted,
// *before* navigating away from /login.
//
// This used to be `emit('login')`, which App.vue routed to
// `appStore.refreshLogin()` - an async action whose promise the emit dropped.
// refreshLogin() flips `appStore.loading` to true synchronously and back to
// false only once it has read and decoded the token, so it raced the
// navigation that immediately followed. App.vue gates <router-view> on
// `appStore.loading && !route.path.includes('login')`, so whenever the route
// reached '/' while that flag was still set, the just-mounted Map.vue was torn
// down and remounted a tick later - running mapStore.destroy() and
// mapStore.init() concurrently against the same singleton store.
//
// Awaiting the refresh makes the ordering deterministic: auth state is settled
// while we are still on /login (where App.vue's gate is exempt, so there is no
// flicker), and the route only changes afterwards. Map.vue mounts once.
//
// Returns false when the session could not be verified - refreshLogin() has
// already cleared it and routed back to /login in that case, so the caller
// must not navigate on top of that.
async function settleSession(): Promise<boolean> {
    await appStore.refreshLogin();
    return appStore.user;
}

async function createLogin() {
    loading.value = true;

    try {
        const res = await server.POST('/api/login', {
            body: {
                username: body.value.username,
                password: body.value.password
             }
        });
        if (res.error) throw new Error(res.error.message);
        const login = res.data;

        await applySession({ token: login.token, refresh: login.refresh, email: login.email, session: login.session });

        await navigateAfterLogin();
    } catch (err) {
        loading.value = false;
        // When OIDC is forced and the backend rejects a non-admin local login,
        // redirect to SSO instead of bubbling up a confusing error.
        if (albOidcForced.value && err instanceof Error && err.message.includes('restricted')) {
            loginWithSSO();
        } else {
            throw err;
        }
    }
}

onUnmounted(() => {
    removeSSOListener?.();
    WebAuthnAbortService.cancelCeremony();
});

async function startConditionalPasskey() {
    try {
        if (!window.PublicKeyCredential
            || !PublicKeyCredential.isConditionalMediationAvailable
            || !(await PublicKeyCredential.isConditionalMediationAvailable())
        ) return;

        const optionsRes = await server.POST('/api/login/passkey/authenticate/options', {
            body: {}
        });
        if (optionsRes.error) throw new Error(optionsRes.error.message);

        const credential = await startAuthentication({
            optionsJSON: optionsRes.data as unknown as PublicKeyCredentialRequestOptionsJSON,
            useBrowserAutofill: true,
        });

        await completePasskeyLogin(credential);
    } catch {
        // Conditional mediation was cancelled or unavailable
    }
}

async function authenticatePasskey() {
    loading.value = true;

    try {
        const optionsRes = await server.POST('/api/login/passkey/authenticate/options', {
            body: {}
        });
        if (optionsRes.error) throw new Error(optionsRes.error.message);

        const credential = await startAuthentication({ optionsJSON: optionsRes.data as unknown as PublicKeyCredentialRequestOptionsJSON });

        await completePasskeyLogin(credential);
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function completePasskeyLogin(credential: AuthenticationResponseJSON) {
    loading.value = true;

    try {
        const res = await server.POST('/api/login/passkey/authenticate', {
            body: {
                credential: {
                    id: credential.id,
                    rawId: credential.rawId,
                    response: {
                        clientDataJSON: credential.response.clientDataJSON,
                        authenticatorData: credential.response.authenticatorData,
                        signature: credential.response.signature,
                        userHandle: credential.response.userHandle,
                    },
                    authenticatorAttachment: credential.authenticatorAttachment,
                    clientExtensionResults: credential.clientExtensionResults as Record<string, unknown>,
                    type: credential.type,
                }
            }
        });
        if (res.error) throw new Error(res.error.message);
        const login = res.data;

        await applySession({ token: login.token, refresh: login.refresh, email: login.email, session: login.session });

        if (login.certRenewalRequired) {
            certRenewal.required = true;
            certRenewal.expired = Boolean(login.certExpired);
            certRenewal.email = login.email;
            certRenewal.password = '';
            loading.value = false;
            return;
        }

        await navigateAfterLogin();
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function navigateAfterLogin(): Promise<void> {
    if (!await settleSession()) return;

    if (route.query.redirect && !String(route.query.redirect).includes('/login')) {
        const redirectPath = String(route.query.redirect);
        const resolved = router.resolve(redirectPath);

        const isSafeRedirect = (() => {
            try {
                const url = new URL(redirectPath, window.location.origin);
                const isSameOrigin = url.origin === window.location.origin;
                const isHttpProtocol = url.protocol === 'http:' || url.protocol === 'https:';
                return isSameOrigin && isHttpProtocol;
            } catch {
                return false;
            }
        })();

        if (resolved.matched.length > 0) {
            router.replace(redirectPath);
        } else if (isSafeRedirect) {
            window.location.href = redirectPath;
        } else {
            router.replace("/");
        }
    } else {
        router.replace("/");
    }
}

async function renewCertificate() {
    loading.value = true;

    try {
        const res = await server.POST('/api/login', {
            body: {
                username: certRenewal.email,
                password: certRenewal.password,
            }
        });
        if (res.error) throw new Error(res.error.message);
        const login = res.data;

        await applySession({ token: login.token, refresh: login.refresh, email: login.email, session: login.session });
        certRenewal.required = false;
        certRenewal.expired = false;
        certRenewal.password = '';

        await navigateAfterLogin();
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

// Only offered while the certificate is still valid (expiring soon, not expired)
async function skipCertRenewal(): Promise<void> {
    certRenewal.required = false;
    certRenewal.expired = false;
    certRenewal.password = '';
    await navigateAfterLogin();
}

async function loginWithSSO() {
    const redirect = String(route.query.redirect || '/');

    if (isNativePlatform()) {
        // The bundled app cannot take part in the web redirect flow - see utils/native-sso.ts
        ssoError.value = null;
        loading.value = true;
        loadingMessage.value = 'Opening SSO login...';
        try {
            await startNativeSSO(redirect);
        } catch (err) {
            ssoError.value = err instanceof Error ? err.message : 'Unable to start SSO login';
        }
        // The browser is on screen now. Show the login form again behind it, so
        // that closing the browser without finishing leaves a usable page
        loading.value = false;
        return;
    }

    window.location.href = `/api/login/oidc?redirect=${encodeURIComponent(redirect)}`;
}

// Native app: the system browser returned to us through the URL scheme
async function handleSSOCallback(callback: SSOCallback): Promise<void> {
    await closeSSOBrowser();

    if ('error' in callback) {
        await cancelNativeSSO();
        loading.value = false;
        ssoError.value = callback.error;
        return;
    }

    loading.value = true;
    loadingMessage.value = 'Completing login...';
    try {
        const result = await completeNativeSSO(callback.code);
        if (!result) {
            // Nothing pending: a repeated delivery of a login that already finished
            loading.value = false;
            return;
        }
        await applySession(result.login);
        if (!await settleSession()) return;
        await router.replace(result.redirect.startsWith('/') ? result.redirect : '/');
    } catch (err) {
        loading.value = false;
        ssoError.value = err instanceof Error ? err.message : 'SSO login failed';
    }
}
</script>

<style scoped>
.logo-visible {
    opacity: 1 !important;
}

.bg-fade-enter {
    animation: fadeIn 0.8s ease-in-out forwards;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
</style>
