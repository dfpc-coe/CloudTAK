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
                                    Welcome to CloudTAK
                                </h2>
                                <h2 class='h4 text-center mb-4'>
                                    Initial Administration User Configuration
                                </h2>
                                <TablerLoading v-if='loading' />
                                <template v-else>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='name'
                                            autocomplete='name'
                                            icon='user'
                                            label='Name'
                                            placeholder='John Doe'
                                            @keyup.enter='createUser'
                                        />
                                    </div>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='email'
                                            icon='user'
                                            label='Email'
                                            autocomplete='email'
                                            placeholder='your@email.com'
                                            @keyup.enter='createUser'
                                        />
                                    </div>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='phone'
                                            label='Phone'
                                            icon='user'
                                            autocomplete='tel'
                                            placeholder='###-###-####'
                                            @keyup.enter='createUser'
                                        />
                                    </div>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='password'
                                            label='Password'
                                            icon='lock'
                                            type='password'
                                            placeholder='Your password'
                                            autocomplete='on'
                                            @keyup.enter='createUser'
                                        />
                                    </div>
                                    <div class='form-footer'>
                                        <button
                                            type='submit'
                                            class='btn btn-primary w-100'
                                            @click='createUser'
                                        >
                                            Create Admin
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

<script lang='ts'>
import { std } from '../std.ts';
import type { Server } from '../types.ts';
import {
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler'

export default {
    name: 'InitialConfigure',
    components: {
        TablerInput,
        TablerLoading
    },
    data: function() {
        return {
            loading: false,
            name: '',
            email: '',
            phone: '',
            password: ''
        }
    },
    mounted: async function() {
        let server;
        try {
            server = await std('/api/server') as Server;
        } catch (err) {
            console.error(err);
        }

        if (!server || server.status === 'configured') {
            delete localStorage.token;
            window.location.href = '/login';
        }
    },
    methods: {
        createUser: async function() {
            this.loading = true;
            await std('/api/user', {
                method: 'POST',
                body: {
                    name: this.name,
                    username: this.email,
                    phone: this.phone,
                    password: this.password
                }
            })

            this.$router.push('/login');
        }
    }
}
</script>
