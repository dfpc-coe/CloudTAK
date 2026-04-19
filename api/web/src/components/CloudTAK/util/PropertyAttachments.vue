<template>
    <div class='col-12 pt-2'>
        <SlideDownHeader
            v-model='expanded'
            label='Attachments'
        >
            <template #icon>
                <IconPaperclip
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <IconFileUpload
                    v-if='!upload'
                    v-tooltip='"Add Attachment"'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer me-2'
                    @click.stop='upload = true; expanded = true'
                />
                <TablerBadge
                    class='me-2'
                    background-color='rgba(59, 130, 246, 0.15)'
                    border-color='rgba(59, 130, 246, 0.4)'
                    text-color='#3b82f6'
                >
                    {{ files.length }}
                </TablerBadge>
            </template>
            <div class='col-12'>
                <div class='mx-2 py-2'>
                    <div class='rounded cloudtak-accent px-2 py-2'>
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
                                        class='px-2 py-2 cloudtak-hover rounded'
                                    >
                                        <div
                                            class='d-flex align-items-center justify-content-center'
                                            style='
                                                height: 200px;
                                                width: 200px;
                                            '
                                        >
                                            <img
                                                v-if='[".png", ".jpg", ".jpeg", ".webp"].includes(file.ext.toLowerCase())'
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

                                            <div class='ms-auto d-flex'>
                                                <TablerDelete
                                                    v-if='subscription && subscription.role && subscription.role.permissions.includes("MISSION_WRITE")'
                                                    displaytype='icon'
                                                    :size='24'
                                                    @delete='deleteAttachment(file)'
                                                />
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
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { server, std, stdurl } from '../../../std.ts';
import { useFloatStore } from '../../../stores/float.ts';
import Upload from '../../util/Upload.vue';
import SlideDownHeader from './SlideDownHeader.vue';
import Subscription from '../../../base/subscription.ts';
import type { Attachment } from '../../../types.ts';
import {
    IconFile,
    IconDownload,
    IconPaperclip,
    IconFileUpload,
} from '@tabler/icons-vue';

import {
    TablerBadge,
    TablerIconButton,
    TablerLoading,
    TablerNone,
    TablerDelete,
} from '@tak-ps/vue-tabler'

const props = withDefaults(defineProps<{
    modelValue: string[];
    subscription?: Subscription | null;
}>(), {
    subscription: null
});

const emit = defineEmits<{
    'update:modelValue': [value: string[]];
}>();

const floatStore = useFloatStore();

const expanded = ref(false);
const upload = ref(false);
const loading = ref(true);
const files = ref<Attachment[]>([]);

watch(() => props.modelValue, async (newVal, oldVal) => {
    if (newVal.length === oldVal.length && newVal.every((h, i) => h === oldVal[i])) return;
    await refresh();
});

watch(files, () => {
    const newHashes = files.value.map(f => f.hash);
    const same = newHashes.length === props.modelValue.length
        && newHashes.every((h, i) => h === props.modelValue[i]);
    if (same) return;
    emit('update:modelValue', newHashes);
}, {
    deep: true
});

onMounted(async () => {
    await refresh();
});

function attachmentPane(file: Attachment): void {
    floatStore.addAttachment(file);
}

async function deleteAttachment(file: Attachment): Promise<void> {
    if (!props.subscription) return;

    await props.subscription.contents.delete(file.hash);

    files.value = files.value.filter(f => f.hash !== file.hash);
}

async function refresh(): Promise<void> {
    loading.value = true;
    if (props.modelValue.length) {
        await fetchMetadata();
    } else {
        files.value = [];
    }

    loading.value = false;
}

function uploadHeaders(): Record<string, string> {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

function hasHash(val: unknown): val is { hash: string } {
    return (
        typeof val === 'object'
        && val !== null
        && 'hash' in val
        && typeof (val as { hash: unknown }).hash === 'string'
    );
}

async function uploadComplete(event: unknown): Promise<void> {
    if (!hasHash(event)) return;

    loading.value = true;
    upload.value = false;

    const res = await server.GET('/api/attachment', {
        params: {
            query: {
                hash: event.hash
            }
        }
    });

    if (res.error) throw new Error(String(res.error));
    if (res.data) files.value.push(...res.data.items);

    loading.value = false;
}

function uploadURL(): URL {
    const url = stdurl(`/api/attachment`);
    if (props.subscription?.meta?.guid) {
        url.searchParams.set('mission', props.subscription.meta.guid);
    }
    return url;
}

function downloadAssetUrl(file: Attachment): string {
    const url = stdurl(`/api/attachment/${file.hash}`);
    url.searchParams.set('token', localStorage.token);
    return url.toString();
}

async function downloadAsset(file: Attachment): Promise<void> {
    const url = stdurl(`/api/attachment/${file.hash}`);
    url.searchParams.set('download', 'true');
    await std(url, { download: file.name });
}

async function fetchMetadata(): Promise<void> {
    const res = await server.GET('/api/attachment', {
        params: {
            query: {
                hash: props.modelValue
            }
        }
    });

    if (res.error) throw new Error(String(res.error));
    if (res.data) files.value = res.data.items;
}
</script>


