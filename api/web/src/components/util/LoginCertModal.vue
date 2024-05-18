<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='close'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-header'>
            <div class='modal-title'>
                Connection Login
            </div>
        </div>
        <div class='modal-body row'>
            <TablerLoading
                v-if='loading.generate'
                desc='Generating Certificate'
            />
            <template v-else>
                <div class='col-12'>
                    <TablerInput
                        v-model='body.username'
                        label='Connection Username'
                        @keyup.enter='generate'
                    />
                </div>
                <div class='col-12 mt-3'>
                    <TablerInput
                        v-model='body.password'
                        label='Connection Password'
                        type='password'
                        @keyup.enter='generate'
                    />
                </div>
                <div class='col-12 mt-3'>
                    <div class='col'>
                        <a
                            class='cursor-pointer btn w-100'
                            @click='generate'
                        >Generate Certificate</a>
                    </div>
                </div>
            </template>
        </div>
    </TablerModal>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerModal,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'LoginCertModal',
    components: {
        TablerModal,
        TablerInput,
        TablerLoading
    },
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
                this.$emit('close');
            } catch (err) {
                this.loading.generate = false;
                throw err;
            }
        },
        close: function() {
            this.$emit('close');
        },
    }
}
</script>
