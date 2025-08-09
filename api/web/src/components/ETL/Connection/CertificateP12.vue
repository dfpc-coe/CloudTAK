<template>
    <div class='card'>
        <div class='card-body text-center py-4'>
            <template v-if='!file'>
                <form
                    id='dropzone-default'
                    class='dropzone dz-clickable'
                    action='./'
                    autocomplete='off'
                    novalidate=''
                >
                    <div class='dz-default dz-message'>
                        <button
                            class='dz-button'
                            type='button'
                        >
                            Drop .p12 here<br>click to upload
                        </button>
                    </div>
                </form>
            </template>
            <template v-else>
                <TablerInput
                    v-model='password'
                    type='password'
                    autocomplete='off'
                    label='P12 Password'
                    @keyup.enter='extract'
                />

                <div class='row mt-3'>
                    <div class='col'>
                        <a
                            class='cursor-pointer btn w-100'
                            @click='extract'
                        >OK</a>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script>
import {
    TablerInput
} from '@tak-ps/vue-tabler';
import Dropzone from 'dropzone/dist/dropzone.mjs';
import 'dropzone/dist/dropzone.css';
import '@tabler/core/dist/css/tabler-vendors.min.css';
import { convertToPem } from 'p12-pem/lib/lib/p12.js';

export default {
    name: 'CertificateP12',
    components: {
        TablerInput
    },
    emits: [
        'certs'
    ],
    data: function() {
        return {
            dropzone: null,
            password: '',
            file: null
        }
    },
    mounted: function() {
        this.createDropzone();
    },
    methods: {
        createDropzone: function() {
            this.$nextTick(() => {
                this.dropzone = new Dropzone("#dropzone-default", {
                    autoProcessQueue: false,
                });

                this.dropzone.on('addedfile', (file) => {
                    const read = new FileReader();
                    read.onload = (event) => {
                        this.file = event.target.result;
                    };
                    read.readAsDataURL(file);
                });
            });
        },
        extract: function() {
            try {
                const certs = convertToPem(atob(this.file.split('base64,')[1]), this.password);
                const cert = certs.pemCertificate
                    .split('-----BEGIN CERTIFICATE-----')
                    .join('-----BEGIN CERTIFICATE-----\n')
                    .split('-----END CERTIFICATE-----')
                    .join('\n-----END CERTIFICATE-----');
                const key = certs.pemKey
                    .split('-----BEGIN RSA PRIVATE KEY-----')
                    .join('-----BEGIN RSA PRIVATE KEY-----\n')
                    .split('-----END RSA PRIVATE KEY-----')
                    .join('\n-----END RSA PRIVATE KEY-----');

                this.$emit('certs', { key, cert });
            } catch (err) {
                this.file = null;
                this.password = '';
                this.createDropzone();
                throw err;
            }
        }
    }
}
</script>
