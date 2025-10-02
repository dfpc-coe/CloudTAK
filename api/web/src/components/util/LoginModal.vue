<template>
    <TablerModal>
        <div class='px-4 py-4'>
            <div
                class='text-center'
                style='margin-bottom: 24px;'
            >
                <img
                    src='/logo.png'
                    style='height: 150px;'
                >
            </div>
            <h2 class='h2 text-center mb-2'>
                Authentication Expired
            </h2>
            <div class='w-100 text-center'>
                Your session has expired, login to continue
            </div>

            <TablerLoading
                v-if='loading'
                desc='Logging in'
            />
            <template v-else>
                <div class='mb-3'>
                    <label class='form-label'>Username or Email</label>
                    <input
                        v-model='username'
                        type='text'
                        class='form-control'
                        placeholder='your@email.com'
                        autocomplete='off'
                        @keyup.enter='createLogin'
                    >
                </div>
                <div class='mb-2'>
                    <label class='form-label'>
                        Password
                        <span class='form-label-description'>
                            <a
                                class='cursor-pointer'
                                @click='external("https://cotak.gov/forgot-password")'
                            >Forgot Password</a>
                        </span>
                    </label>
                    <div class='input-group input-group-flat'>
                        <input
                            v-model='password'
                            type='password'
                            class='form-control'
                            placeholder='Your password'
                            autocomplete='off'
                            @keyup.enter='createLogin'
                        >
                    </div>
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
    </TablerModal>
</template>

<script setup>
import { ref } from 'vue';
import { std } from '/src/std.ts';
import {
    TablerLoading,
    TablerModal
} from '@tak-ps/vue-tabler'

const emit = defineEmits([
    'login'
]);

const loading = ref(false);
const username = ref('');
const password = ref('');

function external(url) {
    window.location = new URL(url);
}

async function createLogin() {
    loading.value = true;
    try {
        const login = await std('/api/login', {
            method: 'POST',
            body: {
                username: username.value,
                password: password.value
            }
        });

        localStorage.token = login.token;

        emit('login');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
