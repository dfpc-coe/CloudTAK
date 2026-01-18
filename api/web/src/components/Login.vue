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
                                <template v-else>
                                    <div class='mb-3'>
                                        <TablerInput
                                            v-model='body.username'
                                            icon='user'
                                            :label='brandStore.login?.username || "Username or Email"'
                                            :placeholder='brandStore.login?.username || "your@email.com"'
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
    </div>
</template>

<script setup lang='ts'>
import type { Login_Create, Login_CreateRes } from '../types.ts'
import { ref, computed, onMounted } from 'vue';
import { useBrandStore } from '../stores/brand.ts';
import { useRouter, useRoute } from 'vue-router'
import { std } from '../std.ts';
import {
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler'

const emit = defineEmits([ 'login' ]);

const route = useRoute();
const router = useRouter();
const brandStore = useBrandStore();

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

const loading = ref(false);
const body = ref<Login_Create>({
    username: '',
    password: ''
});

onMounted(async () => {
    await brandStore.init();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
                registration.update();
            }
        });
    }

    const deleteDB = indexedDB.deleteDatabase('CloudTAK');

    deleteDB.onerror = (event) => {
        console.error('Failed to delete existing database', event);
    };
})

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
    } catch (err) {
        loading.value = false;
        throw err;
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
