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
                    novalidate
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

<script setup lang='ts'>
import { ref, onMounted, nextTick } from 'vue';
import { 
    TablerModal,
    TablerInput
} from '@tak-ps/vue-tabler';
import Dropzone from 'dropzone/dist/dropzone.mjs';
import 'dropzone/dist/dropzone.css';
import '@tabler/core/dist/css/tabler-vendors.min.css';
import { convertToPem, type ConvertToPemResult } from '@tak-ps/node-p12/browser';

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'certs', certs: ConvertToPemResult): void;
}>();

const dropzone = ref<InstanceType<typeof Dropzone> | null>(null);
const password = ref<string>('');
const file = ref<string | null>(null);

onMounted(() => {
    nextTick(() => {
        dropzone.value = new Dropzone("#dropzone-default", {
            autoProcessQueue: false
        });

        dropzone.value.on('addedfile', (f: File) => {
            const read = new FileReader();
            read.onload = (event: ProgressEvent<FileReader>) => {
                file.value = event.target?.result as string;
            };
            read.readAsDataURL(f);
        });
    });
});

function close() {
    emit('close');
}

function extract() {
    if (!file.value) return;
    const certs = convertToPem(atob(file.value.split('base64,')[1]), password.value);
    emit('certs', certs);
}
</script>
