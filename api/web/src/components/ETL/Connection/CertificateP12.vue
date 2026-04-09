<template>
    <div class='card'>
        <div class='card-body text-center py-4'>
            <template v-if='!file'>
                <form
                    id='dropzone-default'
                    class='dropzone dz-clickable'
                    action='./'
                    autocomplete='off'
                    :novalidate='true'
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
                    autocomplete='new-password'
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

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { TablerInput } from '@tak-ps/vue-tabler';
import Dropzone from 'dropzone/dist/dropzone.mjs';
import 'dropzone/dist/dropzone.css';
import '@tabler/core/dist/css/tabler-vendors.min.css';
import { convertToPem } from 'p12-pem/src/lib/p12.js';

interface CertPair {
    key: string;
    cert: string;
}

const emit = defineEmits<{
    certs: [CertPair];
}>();

const dropzoneInstance = ref<Dropzone | null>(null);
const password = ref<string>('');
const file = ref<string | null>(null);

onMounted(() => {
    createDropzone();
});

function createDropzone(): void {
    nextTick(() => {
        dropzoneInstance.value = new Dropzone('#dropzone-default', {
            autoProcessQueue: false,
        });

        dropzoneInstance.value.on('addedfile', (f: File) => {
            const read = new FileReader();
            read.onload = (event: ProgressEvent<FileReader>) => {
                const result = event.target?.result;
                if (typeof result === 'string') {
                    file.value = result;
                }
            };
            read.readAsDataURL(f);
        });
    });
}

function extract(): void {
    if (!file.value) return;

    try {
        const b64 = file.value.split('base64,')[1];
        const certs = convertToPem(atob(b64), password.value);

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
