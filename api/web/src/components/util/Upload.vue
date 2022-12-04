<template>
    <Modal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
            <div class="modal-status bg-yellow"></div>
            <div class="modal-body text-center py-4">
                <form class="dropzone dz-clickable" id="dropzone-default" action="./" autocomplete="off" novalidate="">
                    <div class="dz-default dz-message">
                        <button class="dz-button" type="button">Drop .p12 here<br>click to upload</button>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <div class="w-100">
                    <div class="row">
                        <div class="col"><a @click='close' class="cursor-pointer btn w-100">OK</a></div>
                    </div>
                </div>
          </div>
    </Modal>
</template>

<script>
import { Modal } from '@tak-ps/vue-tabler';
import Dropzone from '@tabler/core/dist/libs/dropzone/dist/dropzone.mjs';
import '@tabler/core/dist/libs/dropzone/dist/dropzone.css';
import '@tabler/core/dist/css/tabler-vendors.min.css';

export default {
    name: 'UploadModal',
    data: function() {
        return {
            dropzone: null
        }    
    },
    mounted: function() {
        this.$nextTick(() => {
            this.dropzone = new Dropzone("#dropzone-default", { url: "/file/post"});
        });
    },
    methods: {
        close: function() {
            this.$emit('close');
        }
    },
    components: {
        Modal,
    }
}
</script>
