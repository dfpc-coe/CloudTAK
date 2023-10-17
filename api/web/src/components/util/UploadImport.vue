<template>
<div>
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
        <div v-if='progress && progress < 101' class='row'>
            <TablerLoading :desc='`Uploading ${name}`'/>
            <TablerProgress :percent='progress / 100'/>
        </div>
    </div>
</div>
</template>

<script>
import Dropzone from '@tabler/core/dist/libs/dropzone/dist/dropzone.mjs';
import '@tabler/core/dist/libs/dropzone/dist/dropzone.css';
import '@tabler/core/dist/css/tabler-vendors.min.css';
import {
    TablerLoading,
    TablerProgress
} from '@tak-ps/vue-tabler';

export default {
    name: 'UploadFile',
    data: function() {
        return {
            file: false,
            name: '',
            dropzone: null,
            progress: 0,
            headers: {
                Authorization: `Bearer ${localStorage.token}`
            }
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
    components: {
        TablerLoading,
        TablerProgress
    }
}

</script>
