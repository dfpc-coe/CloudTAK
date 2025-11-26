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

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import {
    TablerInput
} from '@tak-ps/vue-tabler';
import Dropzone from 'dropzone/dist/dropzone.mjs';
import 'dropzone/dist/dropzone.css';
import '@tabler/core/dist/css/tabler-vendors.min.css';
import { convertToPem } from 'p12-pem/lib/lib/p12.js';

const emit = defineEmits([
    'certs'
]);

const dropzone = ref(null);
const password = ref('');
const file = ref(null);

onMounted(() => {
    createDropzone();
});

function createDropzone() {
    nextTick(() => {
        dropzone.value = new Dropzone("#dropzone-default", {
            autoProcessQueue: false,
        });

        dropzone.value.on('addedfile', (f) => {
            const read = new FileReader();
            read.onload = (event) => {
                file.value = event.target.result;
            };
            read.readAsDataURL(f);
        });
    });
}

function extract() {
    try {
        const certs = convertToPem(atob(file.value.split('base64,')[1]), password.value);
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

        emit('certs', { key, cert });
    } catch (err) {
        file.value = null;
        password.value = '';
        createDropzone();
        throw err;
    }
}
</script>
