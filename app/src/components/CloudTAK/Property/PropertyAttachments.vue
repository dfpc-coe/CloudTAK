<template>
    <PropertySection
        label='Attachments'
        :count='files.length'
    >
        <template #actions>
            <TablerIconButton
                v-if='edit && !upload'
                title='Add Attachment'
                @click='upload = true'
            >
                <IconPlus
                    :size='20'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <TablerLoading
            v-if='loading'
            :inline='true'
            class='my-2'
        />
        <TablerError
            v-else-if='error'
            :err='error'
            @close='refresh'
        >
            <template #advanced='{ body }'>
                <CopyField
                    mode='pre'
                    :model-value='body'
                />
            </template>
        </TablerError>
        <Upload
            v-else-if='upload'
            :url='uploadURL()'
            method='PUT'
            :immediate='true'
            @cancel='upload = false'
            @done='uploadComplete($event)'
        />
        <div
            v-else-if='!files.length'
            class='attachments-empty d-flex align-items-center justify-content-center rounded text-secondary small user-select-none'
        >
            No Attachments
        </div>
        <div
            v-else
            class='d-flex flex-wrap gap-2 pb-1'
        >
            <div
                v-for='file of files'
                :key='file.hash'
                class='attachment-thumb cloudtak-hover position-relative rounded overflow-hidden flex-shrink-0'
                :title='file.name'
            >
                <img
                    v-if='isImage(file)'
                    class='w-100 h-100 cursor-pointer'
                    style='object-fit: cover;'
                    :src='downloadAssetUrl(file)'
                    :alt='file.name'
                    @click='attachmentPane(file)'
                >
                <div
                    v-else
                    class='w-100 h-100 d-flex align-items-center justify-content-center cursor-pointer'
                    @click='downloadAsset(file)'
                >
                    <IconFile
                        :size='24'
                        stroke='1.5'
                        class='text-secondary'
                    />
                </div>

                <div class='attachment-thumb__tools cloudtak-hover-hidden position-absolute top-0 end-0 d-flex align-items-center rounded'>
                    <TablerDelete
                        v-if='canRemove'
                        displaytype='icon'
                        title='Remove Attachment'
                        :size='16'
                        @delete='deleteAttachment(file)'
                    />
                    <TablerIconButton
                        title='Download Attachment'
                        @click='downloadAsset(file)'
                    >
                        <IconDownload
                            :size='16'
                            stroke='1.5'
                        />
                    </TablerIconButton>
                </div>

                <span
                    class='attachment-thumb__name position-absolute bottom-0 start-0 end-0 text-truncate'
                    v-text='file.name'
                />
            </div>
        </div>
    </PropertySection>
</template>

<script setup lang="ts">
import CopyField from '../util/CopyField.vue';
import { ref, computed, onMounted, watch } from 'vue';
import { Preferences } from '@capacitor/preferences';
import { server, std, stdurl } from '../../../std.ts';
import { useFloatStore } from '../../../stores/float.ts';
import Upload from '../../util/Upload.vue';
import PropertySection from '../util/PropertySection.vue';
import Subscription from '../../../base/subscription.ts';
import type { Attachment } from '../../../types.ts';
import {
    IconFile,
    IconPlus,
    IconDownload,
} from '@tabler/icons-vue';

import {
    TablerError,
    TablerIconButton,
    TablerLoading,
    TablerDelete,
} from '@tak-ps/vue-tabler'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

const props = withDefaults(defineProps<{
    modelValue: string[];
    subscription?: Subscription | null;
    /** Whether new attachments may be added - machine generated CoTs are read only */
    edit?: boolean;
}>(), {
    subscription: null,
    edit: false
});

const emit = defineEmits<{
    'update:modelValue': [value: string[]];
}>();

const floatStore = useFloatStore();

const upload = ref(false);
const loading = ref(true);
const error = ref<Error | undefined>(undefined);
const files = ref<Attachment[]>([]);
const token = ref<string | null>(null);

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
    token.value = (await Preferences.get({ key: 'token' })).value;
    await refresh();
});

function isImage(file: Attachment): boolean {
    return IMAGE_EXTENSIONS.includes(file.ext.toLowerCase());
}

function attachmentPane(file: Attachment): void {
    floatStore.addAttachment(file);
}

// Mission attachments are removed from the mission itself (requires
// MISSION_WRITE); otherwise the hash is simply dropped from the marker
const canRemove = computed(() => {
    if (!props.subscription) return true;
    return !!props.subscription.role?.permissions.includes('MISSION_WRITE');
});

async function deleteAttachment(file: Attachment): Promise<void> {
    if (props.subscription) {
        await props.subscription.contents.delete(file.hash);
    }

    files.value = files.value.filter(f => f.hash !== file.hash);
}

async function refresh(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    if (props.modelValue.length) {
        try {
            await fetchMetadata();
        } catch (err) {
            error.value = err instanceof Error ? err : new Error(String(err));
        }
    } else {
        files.value = [];
    }

    loading.value = false;
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

    if (res.error) throw new Error(res.error.message);
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
    if (token.value) url.searchParams.set('token', token.value);
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

    if (res.error) throw new Error(res.error.message);
    if (res.data) files.value = res.data.items;
}
</script>

<style scoped>
.attachments-empty {
    height: 44px;
    border: 1px dashed var(--cloudtak-inset-border);
}

/* Square tile: the image fills it, the name is overlaid along the bottom
 * and the download/remove tools appear over the top corner on hover */
.attachment-thumb {
    width: 72px;
    height: 72px;
    background-color: var(--cloudtak-inset-bg);
    border: 1px solid var(--cloudtak-inset-border);
}

.attachment-thumb__name {
    padding: 2px 4px;
    font-size: 10px;
    line-height: 1.3;
    color: #fff;
    background: rgba(0, 0, 0, 0.55);
    pointer-events: none;
}

.attachment-thumb__tools {
    margin: 2px;
    background: var(--cloudtak-surface-bg);
    border: 1px solid var(--cloudtak-surface-border);
}
</style>
