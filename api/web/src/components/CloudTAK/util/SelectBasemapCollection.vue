<template>
    <div class='col-12 mt-3'>
        <label class='form-label'>Collection Folder</label>

        <StandardItem
            class='d-flex align-items-center gap-2 px-2 py-2'
            @click='toggleOptions()'
        >
            <div @click.stop>
                <BasemapCollection v-model:collection='collection' />
            </div>

            <div class='ms-auto'>
                <IconChevronDown
                    v-if='showOptions'
                    :size='20'
                    stroke='1'
                />
                <IconChevronRight
                    v-else
                    :size='20'
                    stroke='1'
                />
            </div>
        </StandardItem>

        <div
            v-if='showOptions'
            class='collection-selector w-100 border rounded p-2 mt-2'
        >
            <TablerInput
                v-model='newFolder'
                label='Create Folder in Path'
                placeholder='New folder name'
                @keydown.enter.prevent='appendFolder()'
            >
                <TablerIconButton
                    title='Add Folder'
                    @click='appendFolder()'
                >
                    <IconPlus
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </TablerInput>

            <div class='small text-white-50 mt-2 mb-2'>
                Select Existing Folder
            </div>

            <TablerLoading
                v-if='loading'
                desc='Loading folders'
            />

            <TablerAlert
                v-else-if='error'
                :err='error'
            />

            <TablerNone
                v-else-if='!childFolders.length'
                :create='false'
                label='No folders'
            />

            <div
                v-else
                class='d-flex flex-column gap-2'
            >
                <StandardItemFolder
                    v-for='folder in childFolders'
                    :key='folder.path'
                    :name='folder.name'
                    @click='setCollection(folder.path)'
                />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref, watch } from 'vue';
import { server } from '../../../std.ts';
import {
    TablerInput,
    TablerIconButton,
    TablerLoading,
    TablerAlert,
    TablerNone,
} from '@tak-ps/vue-tabler';
import { IconPlus, IconChevronDown, IconChevronRight } from '@tabler/icons-vue';
import BasemapCollection from './BasemapCollection.vue';
import StandardItem from './StandardItem.vue';
import StandardItemFolder from './StandardItemFolder.vue';

const collection = defineModel<string>({ required: true });

const props = withDefaults(defineProps<{
    overlay?: boolean;
}>(), {
    overlay: false,
});

const loading = ref(false);
const error = ref<Error | undefined>();
const allCollections = ref<string[]>([]);
const newFolder = ref('');
const showOptions = ref(false);
const hasLoadedFolders = ref(false);

const childFolders = computed(() => {
    const current = splitPath(collection.value);
    const children = new Set<string>();

    for (const existing of allCollections.value) {
        const parts = splitPath(existing);
        if (!startsWith(parts, current)) continue;
        if (parts.length <= current.length) continue;

        children.add(parts[current.length]);
    }

    return Array.from(children)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => {
            const path = joinSegments([ ...current, name ]);
            return { name, path };
        });
});

watch(() => props.overlay, async () => {
    if (showOptions.value) {
        hasLoadedFolders.value = false;
        await fetchCollections();
    }
});

function setCollection(path: string): void {
    collection.value = path;
}

function appendFolder(): void {
    const cleaned = joinSegments(splitPath(newFolder.value));
    if (!cleaned) return;

    const next = collection.value
        ? joinSegments([ ...splitPath(collection.value), ...splitPath(cleaned) ])
        : cleaned;

    collection.value = next;
    newFolder.value = '';
}

async function toggleOptions(): Promise<void> {
    showOptions.value = !showOptions.value;

    if (showOptions.value && !hasLoadedFolders.value) {
        await fetchCollections();
    }
}

async function fetchCollections(): Promise<void> {
    error.value = undefined;
    loading.value = true;

    try {
        const limit = 100;
        const names = new Set<string>();
        let page = 0;
        let total = 0;

        do {
            const { data, error: apiError } = await server.GET('/api/basemap', {
                params: {
                    query: {
                        filter: '',
                        collection: undefined,
                        overlay: props.overlay,
                        limit,
                        page,
                        order: 'asc',
                        sort: 'name',
                        hidden: 'false'
                    }
                }
            });

            if (apiError) throw new Error(apiError.message);
            if (!data) throw new Error('No data returned');

            total = data.total;

            for (const item of data.collections || []) {
                if (typeof item.name === 'string' && item.name.length > 0) {
                    names.add(item.name);
                }
            }

            page += 1;
        } while (page * limit < total);

        allCollections.value = Array.from(names).sort((a, b) => a.localeCompare(b));
        hasLoadedFolders.value = true;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

function splitPath(path: string): string[] {
    return String(path || '')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean);
}

function joinSegments(segments: string[]): string {
    return segments
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join('/');
}

function startsWith(path: string[], prefix: string[]): boolean {
    if (prefix.length > path.length) return false;
    return prefix.every((part, idx) => part === path[idx]);
}
</script>

<style scoped>
.collection-selector {
    border-color: rgba(255, 255, 255, 0.2) !important;
}
</style>