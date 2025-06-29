<template>
    <div class='card mx-2 px-0'>
        <div class='card-body row'>
            <div class='col-md-6'>
                <TablerInput
                    v-model='auth.cert'
                    :rows='5'
                    label='X509 Certificate'
                    @keyup.enter='generate'
                />
            </div>
            <div class='col-md-6'>
                <TablerInput
                    v-model='auth.key'
                    :rows='5'
                    label='Private Key'
                    @keyup.enter='generate'
                />
            </div>
        </div>
        <div class='card-footer'>
            <button
                class='cursor-pointer btn btn-primary w-100'
                @click='generate'
            >
                Submit Certificate
            </button>
        </div>
    </div>
</template>

<script>
import {
    TablerInput,
} from '@tak-ps/vue-tabler';

export default {
    name: 'CertificateRaw',
    components: {
        TablerInput,
    },
    emits: [
        'certs',
    ],
    data: function() {
        return {
            auth: {
                cert: '',
                key: '',
            }
        }
    },
    methods: {
        generate: async function() {
            try {
                this.$emit('certs', this.auth);
            } catch (err) {
                this.loading.generate = false;
                throw err;
            }
        },
    }
}
</script>
