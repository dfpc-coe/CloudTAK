<template>
    <div class='card mx-2 px-0'>
        <div class='card-body'>
            <TablerLoading
                v-if='loading.generate'
                desc='Generating Certificate'
            />
            <template v-else>
                <div class='col-12'>
                    <TablerInput
                        v-model='body.username'
                        icon='user'
                        label='Username'
                        @keyup.enter='generate'
                    />
                </div>
                <div class='col-12 mt-3'>
                    <TablerInput
                        v-model='body.password'
                        icon='lock'
                        label='Password'
                        type='password'
                        @keyup.enter='generate'
                    />
                </div>
            </template>
        </div>
        <div
            v-if='!loading.generate'
            class='card-footer'
        >
            <button
                class='cursor-pointer btn btn-primary w-100'
                @click='generate'
            >
                Generate Certificate
            </button>
        </div>
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'CertificateLogin',
    components: {
        TablerInput,
        TablerLoading
    },
    emits: [
        'certs',
    ],
    data: function() {
        return {
            loading: {
                generate: false
            },
            body: {
                username: '',
                password: '',
            }
        }
    },
    methods: {
        generate: async function() {
            this.loading.generate = true;
            try {
                const res = await std('/api/marti/signClient', {
                    method: 'POST',
                    body: this.body
                });

                this.$emit('certs', res);
            } catch (err) {
                this.loading.generate = false;
                throw err;
            }
        },
    }
}
</script>
