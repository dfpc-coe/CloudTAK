<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class='modal-header'>
            <div class='modal-title'>Connection Login</div>
        </div>
        <div class="modal-body row">
            <TablerLoading v-if='loading.generate'  desc='Generating Certificate'/>
            <template v-else>
                <div class='col-12'>
                    <TablerInput
                        label='Connection Username'
                        v-model='body.username'
                        v-on:keyup.enter='generate'
                    />
                </div>
                <div class='col-12 mt-3'>
                    <TablerInput
                        label='Connection Password'
                        type='password'
                        v-model='body.password'
                        v-on:keyup.enter='generate'
                    />
                </div>
                <div class="col-12 mt-3">
                    <div class="col"><a @click='generate' class="cursor-pointer btn w-100">Generate Certificate</a></div>
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
    },
    components: {
        TablerModal,
        TablerInput,
        TablerLoading
    }
}
</script>
