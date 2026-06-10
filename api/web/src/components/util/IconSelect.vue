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
                <template v-if='selected.name'>
                    <div class='d-flex align-items-center'>
                        <div>
                            <img
                                :src='selected.data'
                                class='img-thumbnail'
                                style='width: 25px; height: auto; margin-right: 5px;'
                            >
                        </div>
                        <div
                            class='mx-2'
                            v-text='selected.name'
                        />
                    </div>
                </template>
                <template v-else>
                    <span class='text-center my-2 mx-2'>No Icon Selected</span>
                </template>

                <div
                    v-if='!disabled'
                    class='ms-auto'
                >
                    <IconTrash
                        v-if='selected.name'
                        v-tooltip='"Remove Icon"'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='removeIcon'
                    />

                    <IconPhotoSearch
                        v-tooltip='"Select Icon"'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='modal = true'
                    />
                </div>
            </div>
        </template>

        <TablerModal
            v-if='modal'
            size='xl'
            @close='modal = false'
        >
            <div class='modal-status bg-blue' />
            <div class='modal-body'>
                <div class='d-flex align-items-center justify-content-between mb-3'>
                    <h3 class='modal-title'>
                        Select Icon
                    </h3>
                    <button
                        type='button'
                        class='btn-close'
                        @click='modal = false'
                    />
                </div>
                <div class='row g-2'>
                    <div class='col-12'>
                        <TablerEnum
                            v-model='params.iconset'
                            :options='setsName'
                            @click.stop
                        />
                    </div>
                    <div class='col-12'>
                        <TablerInput
                            v-model='params.filter'
                            placeholder='Icon Search'
                            @click.stop
                        />
                    </div>
                    <div class='col-12'>
                        <TablerToggle
                            v-model='params.showNames'
                            label='Show Icon Names'
                            :off-value='false'
                            :on-value='true'
                        />
                    </div>
                </div>
                <TablerLoading
                    v-if='loading.icons'
                    desc='Loading Icons'
                />
                <div
                    v-else
                    class='row mt-2'
                    :class='{ "g-2": params.showNames }'
                    style='max-height: 60vh; overflow-y: auto;'
                >
                    <div
                        v-for='icon of list.items'
                        :key='icon.id'
                        class='col-6 col-md-4 col-lg-3 col-xl-2 cursor-pointer'
                        :class='{ "text-center": params.showNames }'
                        @click='selected = icon; err = null; modal = false'
                    >
                        <div class='card'>
                            <div
                                class='card-body text-center p-1'
                                :class='{ "py-2": params.showNames }'
                            >
                                <img
                                    :src='icon.data'
                                    class='img-thumbnail'
                                    :style='params.showNames ? "width: 64px; height: 64px;" : "width: 40px; height: 40px;"'
                                >
                                <div
                                    v-if='params.showNames'
                                    class='mt-1'
                                    style='font-size: 0.85rem;'
                                    v-text='icon.name'
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </TablerModal>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { server } from '../../std.ts';
import {
    IconInfoSquare,
    IconTrash,
    IconPhotoSearch
} from '@tabler/icons-vue';
import {
    TablerInlineAlert,
    TablerHelp,
    TablerEnum,
    TablerNone,
    TablerInput,
    TablerModal,
    TablerLoading,
    TablerToggle
} from '@tak-ps/vue-tabler';
import type { Iconset, Icon, IconList } from '../../types.ts';

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

const modal = ref(false);
const params = ref({
    iconset: '',
    filter: '',
    showNames: false,
});

const selected = ref<Partial<Icon>>({});
const sets = ref<Iconset[]>([]);
const list = ref<IconList>({ total: 0, items: [] });

const ICON_FILE_SUFFIX = /\.(png|svg)$/i;

const setsName = computed<string[]>(() => {
    return sets.value.map((set) => set.name);
});

watch(selected, () => {
    if (!selected.value.path) return;
    emit('update:modelValue', selected.value.path);
}, { deep: true });

watch(params.value, async () => {
    await fetchIcons();
});

watch(() => props.modelValue, async () => {
    await fetchSelected();
});

onMounted(async () => {
    await fetchSelected();
    await fetchIconsets();
    await fetchIcons();
});

function removeIcon(): void {
    selected.value = {};
    emit('update:modelValue', '');
}

function normalizeIconPath(path: string): string {
    let normalized = path;

    if (normalized.includes(':')) {
        const splitAt = normalized.indexOf(':');
        normalized = `${normalized.slice(0, splitAt)}/${normalized.slice(splitAt + 1)}`;
    }

    return normalized.replace(ICON_FILE_SUFFIX, '');
}

async function fetchSelected(): Promise<void> {
    if (
        props.modelValue
        && !props.modelValue.startsWith('2525')
        && (
            props.modelValue.includes(':')
            || props.modelValue.split('/').length === 3
        )
    ) {
        const path = normalizeIconPath(props.modelValue);

        const iconset = path.split('/')[0];
        const icon = path.split('/').splice(1).join('/');

        const { data, error } = await server.GET('/api/iconset/{:iconset}/icon/{:icon}', {
            params: {
                path: {
                    ':iconset': iconset,
                    ':icon': icon
                }
            }
        });

        if (error) {
            if (error.status === 404) {
                err.value = new Error(error.message);
                return;
            }
            throw new Error(error.message);
        }
        if (!data) return;

        err.value = null;
        selected.value = data;
    }
}

async function fetchIconsets(): Promise<void> {
    loading.value.iconset = true;
    const { data, error } = await server.GET('/api/iconset', {
        params: {
            query: {
                limit: 50,
                page: 0,
                order: 'asc',
                sort: 'name',
                filter: ''
            }
        }
    });

    if (error) throw new Error(error.message);

    sets.value = data?.items || [];
    if (sets.value.length) {
        params.value.iconset = sets.value[0].name;
    }
    loading.value.iconset = false;
}

async function fetchIcons(): Promise<void> {
    loading.value.icons = true;
    const iconset = params.value.iconset
        ? sets.value.find((set) => set.name === params.value.iconset)?.uid
        : undefined;

    const { data, error } = await server.GET('/api/icon', {
        params: {
            query: {
                limit: 1000,
                page: 0,
                order: 'asc',
                iconset,
                filter: params.value.filter
            }
        }
    });

    if (error) throw new Error(error.message);

    list.value = data || { total: 0, items: [] };
    loading.value.icons = false;
}

</script>
