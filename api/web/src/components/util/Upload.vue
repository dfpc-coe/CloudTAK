<template>
    <div class='card-body'>
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
            v-else-if='file && progress > 0 && progress < 101'
        >
            <TablerLoading :desc='`Uploading ${file.name}`' />
            <TablerProgress :percent='progress / 100' />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import {
    IconFile
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerProgress
} from '@tak-ps/vue-tabler';

// Define component properties with types and default values
interface Props {
    url: URL;
    autoupload?: boolean;
    headers?: Record<string, string>;
    method?: string;
    cancel?: boolean;
    label?: string;
    mimetype?: string;
}

const props = withDefaults(defineProps<Props>(), {
    headers: () => ({}),
    autoupload: true,
    method: 'POST',
    cancel: true,
    label: 'Select a file to upload',
    mimetype: '*'
});

// Define the events emitted by this component
const emit = defineEmits<{
    (e: 'cancel'): void;
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

async function upload() {
    if (!file.value) throw new Error('No file staged for upload');

  const formData = new FormData();

  formData.append('file', file.value.file);

  // Combine default and custom headers into a single object
  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    ...props.headers,
  };

  try {
    const response = await fetch(props.url, {
      method: props.method,
      headers: headers,
      body: formData,
    });

    // Check if the request was successful (status in the 200-299 range)
    if (response.ok) {
      progress.value = 101; // Signal completion
      const responseData = await response.json(); // Assuming the server sends a JSON response
      emit('done', responseData);

      return responseData;
    } else {
      // Handle HTTP errors like 404 or 500
      console.error('Upload failed:', response.status, response.statusText);
      emit('cancel');
    }
  } catch (error) {
    // Handle network errors (e.g., failed to connect)
    console.error('Upload error:', error);
    emit('cancel');
  }
}

// Expose the refresh function so parent components can call it
defineExpose({
    refresh,
    upload
});
</script>

