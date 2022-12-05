<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
            <div class="modal-status bg-yellow"></div>
            <div class="modal-body text-center py-4">
                <template v-if='!file'>
                    <form class="dropzone dz-clickable" id="dropzone-default" action="./" autocomplete="off" novalidate="">
                        <div class="dz-default dz-message">
                            <button class="dz-button" type="button">Drop .p12 here<br>click to upload</button>
                        </div>
                    </form>
                </template>
                <template v-else>

                    <TablerInput
                        label='P12 Password'
                        v-model='password'
                    />

                    <div class="row mt-3">
                        <div class="col"><a @click='extract' class="cursor-pointer btn w-100">OK</a></div>
                    </div>
                </template>
            </div>
    </TablerModal>
</template>

<script>
import { Modal, Input } from '@tak-ps/vue-tabler';
import Dropzone from '@tabler/core/dist/libs/dropzone/dist/dropzone.mjs';
import '@tabler/core/dist/libs/dropzone/dist/dropzone.css';
import '@tabler/core/dist/css/tabler-vendors.min.css';
import { convertToPem } from 'p12-pem/lib/lib/p12.js';

export default {
    name: 'UploadP12Modal',
    data: function() {
        return {
            dropzone: null,
            password: '',
            file: null
        }
    },
    mounted: function() {
        this.$nextTick(() => {
            this.dropzone = new Dropzone("#dropzone-default");

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
            try {
                const certs = convertToPem(atob(this.file.split('base64,')[1]), this.password);
                this.$emit('certs', certs);
            } catch (err) {
                this.$emit('err', err);
            }
        }
    },
    components: {
        TablerModal: Modal,
        TablerInput: Input
    }
}
</script>
