<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='close'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-body text-center py-4'>
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
    </TablerModal>
</template>

<script>
import { 
    TablerModal,
    TablerInput
} from '@tak-ps/vue-tabler';
import Dropzone from 'dropzone/dist/dropzone.mjs';
import 'dropzone/dist/dropzone.css';
import '@tabler/core/dist/css/tabler-vendors.min.css';
import { convertToPem } from 'p12-pem/lib/lib/p12.js';

export default {
    name: 'UploadP12Modal',
    components: {
        TablerModal,
        TablerInput
    },
    emits: [
        'close',
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
        this.$nextTick(() => {
            this.dropzone = new Dropzone("#dropzone-default", {
                autoProcessQueue: false
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
    methods: {
        close: function() {
            this.$emit('close');
        },
        extract: function() {
            const certs = convertToPem(atob(this.file.split('base64,')[1]), this.password);
            this.$emit('certs', certs);
        }
    }
}
</script>
