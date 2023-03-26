<template>
<div class='card-body'>
    <div class='row' :class='{ "none": progress !== 0 }'>
        <div class='col-12 d-flex justify-content-center mb-3' v-text='label'></div>
        <div class='col-12 d-flex justify-content-center'>
            <div class='btn-list'>
                <button @click='$emit("cancel")' class='btn btn-secondary'>Cancel</button>
                <button @click='$refs.fileInput.click()' class='btn btn-primary'>Upload</button>
            </div>
        </div>
        <form>
            <input
                ref='fileInput'
                class='d-none'
                type='file'
                id='file'
                name='file'
                :accept='mimetype'
                @change='upload'
            />
        </form>
    </div>
    <div v-if='progress && progress < 101' class='row'>
        <TablerLoading/>

        <div class='col-12 d-flex justify-content-center' v-text='name'></div>

        <TablerProgress :progress='progress'/>
    </div>
        <div v-else-if='progress === 101'>
            <div class='flex flex--center-main'>
                <svg class='icon color-green w60 h60'><use href='#icon-check'/></svg>
            </div>
            <div class='align-center'>Upload Complete</div>
            <div class='col col--12 clearfix pt12'>
                <template v-if='single'>
                    <button @click='$emit("ok")' class='btn round btn--stroke fr btn--gray'>OK</button>
                </template>
                <template v-else>
                    <button @click='refresh' class='btn round btn--stroke fr btn--gray'>
                        <svg class='fl icon' style='margin-top: 6px;'><use href='#icon-refresh'/></svg>Upload
                    </button>
                </template>
            </div>
        </div>
</div>
</template>

<script>
import {
    TablerLoading,
    TablerProgress
} from '@tak-ps/vue-tabler';

export default {
    name: 'UploadFile',
    props: {
        single: {
            type: Boolean,
            default: false
        },
        url: {
            type: URL,
            required: true
        },
        headers: {
            type: Object,
            default: function() {
                return {};
            }
        },
        label: {
            type: String,
            default: 'Select a file to upload'
        },
        mimetype: {
            type: String,
            default: '*'
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
        upload: function(event) {
            return new Promise((resolve, reject) => {
                const file = event.target.files[0];
                this.name = file.name;

                const xhr = new XMLHttpRequest()
                const formData = new FormData()

                xhr.open('POST', this.url, true)
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
                        return reject(new Error('Failed to upload file'));
                    }

                    this.progress = 101;

                    this.$emit('done', JSON.parse(xhr.responseText));
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
