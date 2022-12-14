<template>
<div>
    <div class="modal-body text-center">
        <form class="dropzone dz-clickable" id="dropzone-default" action="./" autocomplete="off" novalidate="">
            <div class="dz-default dz-message">
                <button class="dz-button" type="button">Drop KML Here<br>or<br>Click to Upload</button>
            </div>
        </form>
    </div>
</div>
</template>

<script>
import Dropzone from '@tabler/core/dist/libs/dropzone/dist/dropzone.mjs';
import '@tabler/core/dist/libs/dropzone/dist/dropzone.css';
import '@tabler/core/dist/css/tabler-vendors.min.css';

export default {
    name: 'UploadInline',
    data: function() {
        return {
            dropzone: null,
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
                read.onload = async (event) => {
                    this.file = event.target.result;

                    const body = new FormData();
                    body.append('file', file);

                    try {
                        this.$emit('asset', await window.std('/api/asset', {
                            method: 'POST',
                            body
                        }));
                    } catch (err) {
                        this.$emit('err', err);
                    }
                };

                read.readAsDataURL(file);
            });
        });
    },
    methods: {
        close: function() {
            this.$emit('close');
        },
    },
}
</script>
