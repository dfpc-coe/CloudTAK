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
                                <TablerLoading
                                    v-if='loading'
                                    desc='Logging in'
                                />
                                <template v-else-if='brandStore.oidc.enabled && brandStore.oidc.enforced'>
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
                                        <TablerInput
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
                                <template v-if='brandStore.oidc.enabled'>
                                    <div
                                        v-if='!brandStore.oidc.enforced'
                                        class='my-3 d-flex align-items-center'
                                    >
                                        <hr class='flex-grow-1 m-0'>
                                        <span class='mx-2 text-muted small'>or</span>
                                        <hr class='flex-grow-1 m-0'>
                                    </div>
                                    <TablerInlineAlert
                                        v-if='!brandStore.oidc.discovery'
                                        class='mb-2'
                                        title='OIDC Misconfigured'
                                        description='The administrator has not configured OIDC correctly. Please contact your system administrator.'
                                        severity='warning'
                                    />
                                    <a
                                        v-else
                                        class='btn btn-secondary w-100 d-flex align-items-center justify-content-center gap-2'
                                        href='/api/login/oidc'
                                    >
                                        <img
                                            v-if='brandStore.oidc.logo'
                                            :src='brandStore.oidc.logo'
                                            style='height: 20px; width: 20px; object-fit: contain;'
                                            alt=''
                                        >
                                        Sign in with {{ brandStore.oidc.name || 'SSO' }}
                                    </a>
                                </template>
                                <template v-if='brandStore.passkey.enabled && !loading'>
                                    <div
                                        v-if='!brandStore.oidc.enabled || !brandStore.oidc.enforced'
                                        class='my-3 d-flex align-items-center'
                                    >
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
                                        description='Your TAK certificate is expiring soon. Please enter your password to renew it.'
                                        severity='warning'
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
import type { Login_Create, Login_CreateRes, ConfigLogin } from '../types.ts'
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { version } from '../../package.json';
import { IconSettings, IconTrash, IconLock, IconFingerprint } from '@tabler/icons-vue';
import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON, AuthenticationResponseJSON } from '@simplewebauthn/browser';
import Config from '../base/config.ts';
import type { FullConfig } from '../base/config.ts';
import { getCurrentEntryBuildId } from '../base/service-worker.ts';
import { useRouter, useRoute } from 'vue-router'
import { std } from '../std.ts';
import {
    TablerBadge,
    TablerLoading,
    TablerInput,
    TablerInlineAlert
} from '@tak-ps/vue-tabler'

const emit = defineEmits([ 'login' ]);

const route = useRoute();
const router = useRouter();

const brandStore = reactive<{
    loaded: boolean;
    login: ConfigLogin | undefined;
    passkey: {
        enabled: boolean;
    };
    oidc: {
        enforced: boolean;
        enabled: boolean;
        discovery: string;
        name: string;
        logo: string;
    };
}>({
    loaded: false,
    login: undefined,
    passkey: {
        enabled: true,
    },
    oidc: {
        enforced: false,
        enabled: false,
        discovery: '',
        name: '',
        logo: ''
    }
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

    // Check if brand is enabled, if not return undefined (hidden)
    // If enabled or default, check logic below
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
    if (!('serviceWorker' in navigator)) return;
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

watch(showSettings, (val) => {
    if (val) fetchWorkers();
});

const loading = ref(false);
const body = ref<Login_Create>({
    username: '',
    password: ''
});
const certRenewal = reactive<{
    required: boolean;
    email: string;
    password: string;
}>({
    required: false,
    email: '',
    password: '',
});

onMounted(async () => {
    const config = await Config.list([
        'login::name',
        'login::logo',
        'login::signup',
        'login::forgot',
        'login::username',
        'login::brand::enabled',
        'login::brand::logo',
        'login::background::enabled',
        'login::background::color',
        'oidc::enforced',
        'oidc::enabled',
        'oidc::discovery',
        'oidc::name',
        'oidc::logo',
        'passkey::enabled' as keyof FullConfig,
    ]);

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
    brandStore.oidc.enforced = config['oidc::enforced'] === true;
    brandStore.oidc.enabled = config['oidc::enabled'] === true;
    brandStore.oidc.discovery = config['oidc::discovery'] as string || '';
    brandStore.oidc.name = config['oidc::name'] as string || '';
    brandStore.oidc.logo = config['oidc::logo'] as string || '';
    brandStore.passkey.enabled = (config as Record<string, unknown>)['passkey::enabled'] !== false;
    brandStore.loaded = true;

    if (brandStore.passkey.enabled) {
        startConditionalPasskey();
    }

    const deleteDB = indexedDB.deleteDatabase('CloudTAK');

    deleteDB.onerror = (event) => {
        console.error('Failed to delete existing database', event);
    };
});

async function createLogin() {
    loading.value = true;

    try {
        const login = await std('/api/login', {
            method: 'POST',
            body: {
                username: body.value.username,
                password: body.value.password
             }
        }) as Login_CreateRes

        localStorage.token = login.token;

        navigateAfterLogin();
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function startConditionalPasskey() {
    try {
        if (!window.PublicKeyCredential
            || !PublicKeyCredential.isConditionalMediationAvailable
            || !(await PublicKeyCredential.isConditionalMediationAvailable())
        ) return;

        const optionsRes = await std('/api/login/passkey/authenticate/options', {
            method: 'POST',
            body: {}
        });

        const credential = await startAuthentication({
            optionsJSON: optionsRes as unknown as PublicKeyCredentialRequestOptionsJSON,
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
        const optionsRes = await std('/api/login/passkey/authenticate/options', {
            method: 'POST',
            body: {}
        });

        const credential = await startAuthentication({ optionsJSON: optionsRes as unknown as PublicKeyCredentialRequestOptionsJSON });

        await completePasskeyLogin(credential);
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function completePasskeyLogin(credential: AuthenticationResponseJSON) {
    loading.value = true;

    try {
        const login = await std('/api/login/passkey/authenticate', {
            method: 'POST',
            body: { credential }
        }) as Login_CreateRes & { certRenewalRequired?: boolean };

        localStorage.token = login.token;

        if (login.certRenewalRequired) {
            certRenewal.required = true;
            certRenewal.email = login.email;
            certRenewal.password = '';
            loading.value = false;
            return;
        }

        navigateAfterLogin();
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

function navigateAfterLogin() {
    emit('login');

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
            router.push(redirectPath);
        } else if (isSafeRedirect) {
            window.location.href = redirectPath;
        } else {
            router.push("/");
        }
    } else {
        router.push("/");
    }
}

async function renewCertificate() {
    loading.value = true;

    try {
        const login = await std('/api/login', {
            method: 'POST',
            body: {
                username: certRenewal.email,
                password: certRenewal.password,
            }
        }) as Login_CreateRes;

        localStorage.token = login.token;
        certRenewal.required = false;
        certRenewal.password = '';

        navigateAfterLogin();
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

function skipCertRenewal() {
    certRenewal.required = false;
    certRenewal.password = '';
    navigateAfterLogin();
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
