<template>
<div>
    <div class='row g-0' :class='{ "d-none": progress !== 0 }'>
        <div class='col-12 d-flex justify-content-center mb-3 subheader'>Select a file to import</div>
        <div 
            ref='dragger'
            :ondragenter='dragEnter'
            :ondragleave='dragLeave'
            :drop='dragDrop'
            class='custom-drop row g-0 d-flex col-12 justify-content-center py-2'
        >
            <div class='col-12 my-3 d-flex justify-content-center'>
                <div>Drag &amp; Drop Files Here</div>
            </div>
            <div class='col-12 d-flex justify-content-center'>
                <div>or</div>
            </div>
            <div class='col-12 d-flex justify-content-center'>
                <div class='btn-list my-3'>
                    <button v-if='cancelButton' @click='$emit("cancel")' class='btn btn-secondary'>Cancel</button>
                    <button @click='$refs.fileInput.click()' class='btn btn-primary'>Select Files</button>
                </div>
            </div>
        </div>
        <form>
            <input
                ref='fileInput'
                class='d-none'
                type='file'
                id='file'
                name='file'
                @change='upload'
            />
        </form>
    </div>
    <div v-if='progress && progress < 101' class='row'>
        <TablerLoading :desc='`Uploading ${name}`'/>
        <TablerProgress :percent='progress / 100'/>
    </div>
</div>
</template>

<style>
.custom-drop {
    border-radius: 10px;
    border-style: solid;
    border-width: 1px;
    border-color: white;
}

.custom-drop-drag {
    border-color: blue;
}
</style>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerLoading,
    TablerProgress
} from '@tak-ps/vue-tabler';

export default {
    name: 'UploadFile',
    props: {
        mode: {
            type: String,
            default: 'Unknown'
        },
        modeid: {
            type: String
        },
        dragging: {
            type: Boolean,
            default: false
        },
        cancelButton: {
            type: Boolean,
            default: true
        },
        config: {
            type: Object,
            default: function() {
                return {};
            }
        }
    },
    data: function() {
        return {
            name: '',
            progress: 0,
        }
    },
    methods: {
        refresh: function() {
            this.name = '';
            this.progress = 0;
            const input = this.$refs.fileInput;
            input.type = 'text';
            input.type = 'file';
        },
        dragEnter: function(event) {
            event.stopPropagation();
            event.preventDefault();
            this.$refs.dragger.classList.add('custom-drop-drag')
        },
        dragLeave: function(event) {
            event.stopPropagation();
            event.preventDefault();
            this.$refs.dragger.classList.remove('custom-drop-drag')
        },
        dragDrop: function(event) {
            
        },
        upload: async function(event) {
            const file = event.target.files[0];
            this.name = file.name;

            const imported = await std('/api/import', {
                method: 'POST',
                body: {
                    name: this.name,
                    mode: this.mode,
                    mode_id: this.modeid,
                    config: this.config
                }
            });

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest()
                const formData = new FormData()

                xhr.open('PUT', stdurl(`/api/import/${imported.id}`), true)
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

                xhr.setRequestHeader('Authorization', `Bearer ${localStorage.token}`);

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
                        this.$emit('done', xhr.response);
                    }
                });

                formData.append('file', file)
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
