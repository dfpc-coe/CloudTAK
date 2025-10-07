<template>
    <div class='col-12 d-flex align-items-center py2'>
        <IconPaperclip
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label class='subheader user-select-none'>Attachments</label>

        <div class='ms-auto me-2'>
            <IconFileUpload
                v-if='!upload'
                v-tooltip='"Add Attachment"'
                :size='24'
                stroke='1'
                class='cursor-pointer'
                @click='upload = true'
            />
        </div>
    </div>
    <div class='col-12'>
        <div class='mx-2'>
            <TablerLoading
                v-if='loading'
                :inline='true'
                class='my-2'
            />
            <div
                v-else-if='upload'
                class='py-2 px-4'
            >
                <Upload
                    :url='uploadURL()'
                    :headers='uploadHeaders()'
                    method='PUT'
                    @cancel='upload = false'
                    @done='uploadComplete($event)'
                />
            </div>

            <TablerNone
                v-else-if='!files.length'
                :compact='true'
                :create='false'
            />
            <template v-else>
                <div class='w-100 d-flex flex-wrap align-items-center justify-content-center'>
                    <template v-for='file of files'>
                        <div
                            class='px-2 py-2 hover rounded'
                        >
                            <div
                                class='d-flex align-items-center justify-content-center'
                                style='
                                    height: 200px;
                                    width: 200px;
                                '
                            >
                                <img
                                    v-if='[".png", ".jpg", ".jpeg", ".webp"].includes(file.ext)'
                                    class='cursor-pointer'
                                    :style='{
                                        "max-height": "180px",
                                        "object-fit": "contain"
                                    }'
                                    :src='downloadAssetUrl(file)'
                                    @click='attachmentPane(file)'
                                >
                                <IconFile
                                    v-else
                                    :size='60'
                                    stroke='1'
                                />
                            </div>

                            <div
                                class='d-flex align-items-center pt-2'
                                style='
                                    height: 30px;
                                '
                            >
                                <span
                                    class='mx-2 text-truncate'
                                    style='max-width: 160px;'
                                    v-text='file.name'
                                />

                                <div class='ms-auto'>
                                    <TablerIconButton
                                        title='Download Asset'
                                        @click='downloadAsset(file)'
                                    >
                                        <IconDownload
                                            :size='24'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { std, stdurl } from '../../../std.ts';
import { useFloatStore } from '../../../stores/float.ts';
import Upload from '../../util/Upload.vue';
import {
    IconFile,
    IconDownload,
    IconPaperclip,
    IconFileUpload,
} from '@tabler/icons-vue';

import {
    TablerIconButton,
    TablerLoading,
    TablerNone
} from '@tak-ps/vue-tabler'

const props = defineProps({
    modelValue: {
        type: Array,
        required: true
    }
});

const emit = defineEmits([
    'update:modelValue'
]);

const floatStore = useFloatStore();

const upload = ref(false);
const loading = ref(true);
const files = ref([]);

watch(props.modelValue, async () => {
    await refresh();
});

watch(files, () => {
    emit("update:modelValue", files.value.map(f => f.hash));
}, {
    deep: true
});

onMounted(async () => {
    await refresh();
})

function attachmentPane(file) {
    floatStore.addAttachment(file);
}

async function refresh() {
    loading.value = true;
    if (props.modelValue.length) {
        await fetchMetadata();
    } else {
        files.value = [];
    }

    loading.value = false;
}

function uploadHeaders() {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

async function uploadComplete(event) {
    loading.value = true;
    upload.value = false;

    const url = stdurl(`/api/attachment`);
    url.searchParams.append('hash', event.hash);
    files.value.push(...(await std(url)).items);

    loading.value = false;
}

function uploadURL() {
    return stdurl(`/api/attachment`);
}

function downloadAssetUrl(file) {
    const url = stdurl(`/api/attachment/${file.hash}`);
    url.searchParams.append('token', localStorage.token);
    return url;
}

async function downloadAsset(file) {
    window.open(downloadAssetUrl(file), "_blank")
}

async function fetchMetadata() {
    const url = stdurl(`/api/attachment`);
    for (const a of props.modelValue) {
        url.searchParams.append('hash', a);
    }

    files.value = (await std(url)).items;
}
</script>
