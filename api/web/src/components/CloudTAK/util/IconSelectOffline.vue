<template>
    <div
        class='row'
    >
        <div class='col-12 d-flex my-1'>
            <span
                v-if='description'
                class='align-self-center'
            >
                <IconInfoSquare
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='help = true'
                />
                <TablerHelp
                    v-if='help'
                    :label='label'
                    :description='description'
                    @click='help = false'
                />
            </span>
            <div
                class='align-self-center subheader'
                :class='{ "required": required }'
                v-text='label'
            />
            <div class='ms-auto align-self-center'>
                <slot />
            </div>
        </div>

        <TablerLoading
            v-if='loading.iconset'
            desc='Loading Iconsets'
        />
        <TablerNone
            v-else-if='sets.length === 0'
            label='No Iconsets Loaded'
            :compact='true'
            :create='false'
        />
        <template v-else>
            <TablerInlineAlert
                v-if='err'
                severity='danger'
                title='Icon Not Found'
                :description='err.message'
            />
            <div class='d-flex align-items-center'>
                <template v-if='selected'>
                    <div class='d-flex align-items-center'>
                        <div>
                            <img
                                :src='selectedUrl'
                                class='img-thumbnail'
                                style='width: 25px; height: auto; margin-right: 5px;'
                            >
                        </div>
                        <div
                            class='mx-2'
                            v-text='selectedDisplayName'
                        />
                    </div>
                </template>
                <template v-else>
                    <span class='text-center my-2 mx-2'>No Icon Selected</span>
                </template>

                <div
                    v-if='!disabled'
                    class='btn-list ms-auto'
                >
                    <IconTrash
                        v-if='selected'
                        v-tooltip='"Remove Icon"'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='removeIcon'
                    />

                    <TablerDropdown>
                        <template #default>
                            <IconPhotoSearch
                                v-tooltip='"Select Icon"'
                                :size='32'
                                stroke='1'
                                class='cursor-pointer'
                            />
                        </template>
                        <template #dropdown>
                            <div
                                class='py-1'
                                style='min-width: 300px;'
                            >
                                <div class='px-3 pt-2 pb-1 d-flex align-items-center fw-bold'>
                                    Icons
                                    <IconSearch
                                        :size='20'
                                        stroke='1'
                                        class='ms-auto cursor-pointer'
                                        :color='params.showFilter ? "#83b7e8" : "currentColor"'
                                        @click.stop.prevent='params.showFilter = !params.showFilter'
                                    />
                                </div>
                                <div class='px-2 pb-2 row g-2'>
                                    <div class='col-12'>
                                        <TablerEnum
                                            v-model='params.iconset'
                                            :options='setsName'
                                        />
                                    </div>
                                    <div class='col-12'>
                                        <TablerInput
                                            v-if='params.showFilter'
                                            v-model='params.filter'
                                            placeholder='Icon Search'
                                        />
                                    </div>
                                    <TablerLoading
                                        v-if='loading.icons'
                                        desc='Loading Icons'
                                    />
                                    <div
                                        v-else
                                        class='row my-2'
                                    >
                                        <div
                                            v-for='icon of filteredIcons'
                                            :key='icon.name'
                                            class='col-auto cursor-pointer'
                                            @click='selectIcon(icon)'
                                        >
                                            <img
                                                v-tooltip='icon.path'
                                                :src='iconUrls.get(icon.name)'
                                                class='img-thumbnail'
                                                style='width: 40px; height: 40px; margin-right: 5px;'
                                            >
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </TablerDropdown>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import Icon from '../../../base/icon.ts';
import Iconset from '../../../base/iconset.ts';
import type { DBIcon, DBIconset } from '../../../base/database.ts';
import {
    IconInfoSquare,
    IconTrash,
    IconSearch,
    IconPhotoSearch
} from '@tabler/icons-vue';
import {
    TablerInlineAlert,
    TablerHelp,
    TablerEnum,
    TablerNone,
    TablerInput,
    TablerDropdown,
    TablerLoading
} from '@tak-ps/vue-tabler';

interface Props {
    modelValue: string;
    description?: string;
    required?: boolean;
    disabled?: boolean;
    label?: string;
}

const props = withDefaults(defineProps<Props>(), {
    description: '',
    required: false,
    disabled: false,
    label: 'Icon Select',
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const help = ref(false);
const err = ref<Error | null>(null);

const loading = ref({
    iconset: true,
    icons: true,
});

const params = ref({
    iconset: '',
    showFilter: false,
    filter: '',
});

const sets = ref<DBIconset[]>([]);
const icons = ref<DBIcon[]>([]);
const iconUrls = ref<Map<string, string>>(new Map());

const selected = ref<DBIcon | null>(null);
const selectedUrl = ref<string>('');

const setsName = computed<string[]>(() => {
    return sets.value.map((set) => set.name);
});

const filteredIcons = computed<DBIcon[]>(() => {
    if (!params.value.filter) return icons.value;
    const f = params.value.filter.toLowerCase();
    return icons.value.filter((icon) => icon.path.toLowerCase().includes(f));
});

const selectedDisplayName = computed<string>(() => {
    if (!selected.value) return '';
    const parts = selected.value.path.split('/');
    return parts[parts.length - 1];
});

watch(() => params.value.iconset, async () => {
    await fetchIcons();
});

watch(() => params.value.filter, async () => {
    await fetchIcons();
});

watch(() => props.modelValue, async () => {
    await fetchSelected();
});

onMounted(async () => {
    await fetchIconsets();
    await fetchSelected();
    await fetchIcons();
});

onUnmounted(() => {
    revokeGridUrls();
    revokeSelectedUrl();
});

function revokeGridUrls(): void {
    for (const url of iconUrls.value.values()) {
        URL.revokeObjectURL(url);
    }
    iconUrls.value = new Map();
}

function revokeSelectedUrl(): void {
    if (selectedUrl.value) {
        URL.revokeObjectURL(selectedUrl.value);
        selectedUrl.value = '';
    }
}

function selectIcon(icon: DBIcon): void {
    revokeSelectedUrl();
    selected.value = icon;
    selectedUrl.value = URL.createObjectURL(icon.data);
    err.value = null;
    emit('update:modelValue', icon.name);
}

function removeIcon(): void {
    revokeSelectedUrl();
    selected.value = null;
    emit('update:modelValue', '');
}

async function fetchSelected(): Promise<void> {
    if (
        !props.modelValue
        || props.modelValue.startsWith('2525')
        || (
            !props.modelValue.includes(':')
            && props.modelValue.split('/').length < 3
        )
    ) {
        return;
    }

    // Normalise to the Dexie key format: "<iconsetUid>:<path-without-ext>"
    let key = props.modelValue;
    if (!key.includes(':')) {
        // slash-separated 3-part path: "<uuid>/<folder>/<name>.png"
        key = key.replace('/', ':').replace(/\.png$/i, '');
    } else {
        // colon-separated – strip any trailing .png just in case
        key = key.replace(/\.png$/i, '');
    }

    const icon = await Icon.get(key);
    if (!icon) {
        err.value = new Error(`Icon not found: ${props.modelValue}`);
        return;
    }

    err.value = null;
    revokeSelectedUrl();
    selected.value = icon;
    selectedUrl.value = URL.createObjectURL(icon.data);
}

async function fetchIconsets(): Promise<void> {
    loading.value.iconset = true;
    sets.value = await Iconset.list();
    if (sets.value.length && !params.value.iconset) {
        params.value.iconset = sets.value[0].name;
    }
    loading.value.iconset = false;
}

async function fetchIcons(): Promise<void> {
    loading.value.icons = true;

    revokeGridUrls();

    const set = sets.value.find((s) => s.name === params.value.iconset);
    if (!set) {
        icons.value = [];
        loading.value.icons = false;
        return;
    }

    const all = await Icon.list(set.uid);
    icons.value = all;

    const urls = new Map<string, string>();
    for (const icon of all) {
        urls.set(icon.name, URL.createObjectURL(icon.data));
    }
    iconUrls.value = urls;

    loading.value.icons = false;
}
</script>
