<template>
    <div
        class='page page-center'
        style='overflow: auto;'
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

<script>
import { std } from '/src/std.ts';
import {
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler'

export default {
    name: 'UserLogin',
    components: {
        TablerInput,
        TablerLoading
    },
    emits: [
        'login'
    ],
    data: function() {
        return {
            loading: false,
            body: {
                username: '',
                password: ''
            }
        }
    },
    methods: {
        external: function(url) {
            window.location = new URL(url);
        },
        createLogin: async function() {
            this.loading = true;
            try {
                const login = await std('/api/login', {
                    method: 'POST',
                    body: this.body
                });

                localStorage.token = login.token;

                this.$emit('login');

                if (this.$route.query.redirect && !this.$route.query.redirect.includes('/login')) {
                    this.$router.push(this.$route.query.redirect);
                } else {
                    this.$router.push("/");
                }
            } catch (err) {
                this.loading = false;
                throw err;
            }
        }
    }
}
</script>
