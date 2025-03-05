<template>
    <div
        class='page page-center cloudtak-gradient position-relative'
        style='overflow: auto;'
    >
        <img
            class='position-absolute d-none d-md-inline'
            style='
                height: 48px;
                bottom: 24px;
                left: 24px;
            '
            src='/CloudTAKLogoText.svg'
            alt='CloudTAK Logo'
        >

        <div class='container container-normal py-4'>
            <div class='row align-items-center g-4'>
                <div class='col-lg'>
                    <div class='container-tight'>
                        <div class='card card-md'>
                            <div class='card-body'>
                                <div
                                    class='text-center'
                                    style='margin-bottom: 24px;'
                                >
                                    <img
                                        src='/logo.png'
                                        style='height: 150px;'
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
                                            label='Username or Email'
                                            placeholder='your@email.com'
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
                                                    class='cursor-pointer'
                                                    @click='external("https://cotak.gov/forgot-password")'
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
                        <div class='text-center text-muted mt-3'>
                            Don't have account yet? <a href='mailto:nicholas.ingalls@state.co.us'>Contact Us</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import type { Login_Create, Login_CreateRes } from '../types.ts'
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router'
import { std } from '../std.ts';
import {
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler'

const emit = defineEmits([ 'login' ]);

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const body = ref<Login_Create>({
    username: '',
    password: ''
});

function external(url: string) {
    window.location.assign(url);
}

async function createLogin() {
    loading.value = true;

    try {
        const login = await std('/api/login', {
            method: 'POST',
            body: {
                username: body.value.username.match(/[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/)
                    ? body.value.username.toLowerCase()
                    : body.value.username,
                password: body.value.password
             }
        }) as Login_CreateRes

        localStorage.token = login.token;

        emit('login');

        if (route.query.redirect && !String(route.query.redirect).includes('/login')) {
            router.push(String(route.query.redirect));
        } else {
            router.push("/");
        }
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
