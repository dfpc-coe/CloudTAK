<template>
    <div class='card-body'>
        <TablerInlineAlert
            severity='warning'
            title='Uploads are limited to 5 GB'
        />
        <div
            class='row'
            :class='{ "d-none": file }'
        >
            <div
                class='col-12 d-flex justify-content-center mb-3'
                v-text='props.label'
            />
            <div class='col-12 d-flex justify-content-center'>
                <div class='btn-list'>
                    <button
                        v-if='props.cancel'
                        class='btn btn-secondary'
                        @click='emit("cancel")'
                    >
                        Cancel
                    </button>
                    <button
                        class='btn btn-primary'
                        @click='fileInput?.click()'
                    >
                        Upload
                    </button>
                </div>
            </div>
            <form>
                <input
                    id='file'
                    ref='fileInput'
                    class='d-none'
                    type='file'
                    name='file'
                    :accept='props.mimetype'
                    @change='stage'
                >
            </form>
        </div>

        <div
            v-if='file && progress === 0'
            class='row'
        >
            <div class='d-flex align-items-center px-3 py-2'>
                <IconFile
                    :size='24'
                    stroke='1'
                />
                <span
                    class='mx-2 user-select-none'
                    v-text='file.name'
                />
            </div>
        </div>
        <div
            v-else-if='file && progress > 0 && progress < 100'
        >
            <TablerLoading :desc='`Uploading ${file.name} (${progress}%)`' />
            <TablerProgress :percent='progress / 100' />
        </div>
        <div
            v-else-if='file && progress === 100'
            class='row'
        >
            <div class='d-flex align-items-center px-3 py-2 text-success'>
                <IconFile
                    :size='24'
                    stroke='1'
                />
                <span
                    class='mx-2 user-select-none'
                    v-text='`${file.name} - Upload Complete`'
                />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import {
    IconFile
} from '@tabler/icons-vue';
import {
    TablerInlineAlert,
    TablerLoading,
    TablerProgress
} from '@tak-ps/vue-tabler';

// Define component properties with types and default values
interface Props {
    url: URL;
    autoupload?: boolean;
    headers?: Record<string, string>;
    format?: 'formdata' | 'raw';
    method?: string;
    cancel?: boolean;
    label?: string;
    mimetype?: string;
}

const props = withDefaults(defineProps<Props>(), {
    headers: () => ({}),
    autoupload: true,
    format: 'formdata',
    method: 'POST',
    cancel: true,
    label: 'Select a file to upload',
    mimetype: '*'
});

// Define the events emitted by this component
const emit = defineEmits<{
    (e: 'cancel'): void;
    (e: 'error', response: Error): void;
    (e: 'staged', response: { name: string }): void;
    (e: 'done', response: unknown): void;
}>();


// Reactive state variables
const file = ref<{
    name: string;
    file: File;
} | undefined>();
const progress = ref<number>(0);
const fileInput = ref<HTMLInputElement | null>(null);

/**
 * Resets the component state and file input.
 * This function is exposed to be callable from a parent component.
 */
function refresh() {
    file.value = undefined;
    progress.value = 0;

    const input = fileInput.value;
    if (input) {
        // A common trick to clear the file input's value
        input.type = 'text';
        input.type = 'file';
    }
}

/**
 * Handles the file upload process when a file is selected.
 * @param event - The file input change event
 */
function stage(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files?.length) return;

    const singleFile = target.files[0];
    file.value = {
        name: singleFile.name,
        file: singleFile
    }

    emit('staged', {
        name: file.value.name
    });

    if (!props.autoupload) return;

    upload();
}

async function upload(opts: {
    query?: Record<string, string>;
} = {}) {
    const currentFile = file.value;
    if (!currentFile) throw new Error('No file staged for upload');

    const url = new URL(props.url.toString());

    if (opts.query) {
        Object.entries(opts.query).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                progress.value = Math.min(percentComplete, 99);
            }
        };

        xhr.onload = () => {
            try {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const responseData = JSON.parse(xhr.responseText);
                    progress.value = 100;
                    emit('done', responseData);
                    resolve(responseData);
                } else {
                    refresh();
                    emit('error', new Error(`Upload Failed: ${xhr.statusText}`));
                    reject(new Error(`Upload Failed: ${xhr.statusText}`));
                }
            } catch (error) {
                refresh();
                emit('error', new Error('Failed to parse response'));
                reject(error);
            }
        };

        xhr.onerror = () => {
            refresh();
            emit('error', new Error('Upload failed'));
            reject(new Error('Upload failed'));
        };

        xhr.onabort = () => {
            refresh();
            emit('cancel');
            reject(new Error('Upload cancelled'));
        };

        // Set headers
        const headers = {
            'X-Requested-With': 'XMLHttpRequest',
            ...props.headers,
        };

        xhr.open(props.method, url.toString());

        // Set headers (excluding Content-Type for FormData, browser sets it automatically)
        Object.entries(headers).forEach(([key, value]) => {
            if (props.format !== 'formdata' || key.toLowerCase() !== 'content-type') {
                xhr.setRequestHeader(key, value);
            }
        });

        // Prepare and send data
        try {
            if (props.format === 'formdata') {
                const formData = new FormData();
                formData.append('file', currentFile.file);
                xhr.send(formData);
            } else if (props.format === 'raw') {
                xhr.send(currentFile.file);
            } else {
                throw new Error('Unsupported upload format');
            }
        } catch (error) {
            refresh();
            console.error('Upload error:', error);
            emit('error', error instanceof Error ? error : new Error(String(error)));
            reject(error);
        }
    });
}

// Expose the refresh function so parent components can call it
defineExpose({
    refresh,
    upload
});
</script>

