<template>
<div>
    <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>
    <div class="modal-status bg-yellow"></div>
    <div class="modal-body text-center py-4">
        <template v-if='!file'>
            <form class="dropzone dz-clickable" id="dropzone-default" action="./" autocomplete="off" novalidate="">
                <div class="dz-default dz-message">
                    <button class="dz-button" type="button">
                        Drop File Here<br><br>or<br><br>Click to Select File
                    </button>
                </div>
            </form>
        </template>
        <div v-if='progress && progress < 101' class='row'>
            <TablerLoading :desc='`Uploading ${file.name}`'/>
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
                this.file = file;
            });
        });
    },
    watch: {
        file: async function() {
            if (this.file) await this.upload();
        }
    },
    methods: {
        upload: function() {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest()
                const formData = new FormData()

                xhr.open('PUT', window.stdurl('/api/import'), true)
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

                for (const header of Object.keys(this.headers)) {
                    xhr.setRequestHeader(header, this.headers[header]);
                }

                xhr.upload.addEventListener('progress', (e) => {
                    this.progress = (e.loaded * 100.0 / e.total) || 100
                });

                xhr.addEventListener('readystatechange', () => {
                    if (xhr.readyState == 4 && xhr.status == 200) {
                        this.progress = 100;
                    } else if (xhr.readyState == 4 && xhr.status != 200) {
                        const err = new Error('Failed to upload file');
                        this.$emit('cancel')
                        return reject(err);
                    }

                    if (xhr.readyState === 4) {
                        this.progress = 101;
                        const imported = JSON.parse(xhr.response).imports[0];
                        this.$router.push(`/import/${imported.uid}`)
                        this.$emit('close', xhr.response);
                    }
                });

                formData.append('file', this.file)
                xhr.send(formData)
            });
        }
    },
    components: {
        TablerLoading,
        TablerProgress
    }
}

</script>
