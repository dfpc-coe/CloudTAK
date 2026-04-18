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
                    class='btn-list ms-auto'
                >
                    <IconTrash
                        v-if='selected.name'
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
                                class='card'
                                style='min-width: 300px;'
                            >
                                <div class='card-header d-flex align-items-center'>
                                    <h3 class='card-title'>
                                        Icons
                                    </h3>
                                    <IconSearch
                                        :size='32'
                                        stroke='1'
                                        class='ms-auto cursor-pointer mx-2'
                                        :color='params.showFilter ? "#83b7e8" : "currentColor"'
                                        @click.stop.prevent='params.showFilter = !params.showFilter'
                                    />
                                </div>

                                <div class='card-body row g-2'>
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
                                            v-for='icon of list.items'
                                            :key='icon.id'
                                            class='col-auto cursor-pointer'
                                            @click='selected = icon'
                                        >
                                            <img
                                                v-tooltip='icon.name'
                                                :src='icon.data'
                                                class='img-thumbnail'
                                                style='width: 25px; height: 25px; margin-right: 5px;'
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
import { ref, watch, computed, onMounted } from 'vue';
import { std, stdurl } from '../../std.ts';
import {
    IconInfoSquare,
    IconTrash,
    IconSearch,
    IconPhotoSearch
} from '@tabler/icons-vue';
import {
    TablerHelp,
    TablerEnum,
    TablerNone,
    TablerInput,
    TablerDropdown,
    TablerLoading
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

const loading = ref({
    iconset: true,
    icons: true,
});

const params = ref({
    iconset: '',
    showFilter: false,
    filter: '',
});

const selected = ref<Partial<Icon>>({});
const sets = ref<Iconset[]>([]);
const list = ref<IconList>({ total: 0, items: [] });

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

async function fetchSelected(): Promise<void> {
    if (
        props.modelValue
        && !props.modelValue.startsWith('2525')
        && (
            props.modelValue.includes(':')
            || props.modelValue.split('/').length === 3
        )
    ) {
        let path = props.modelValue;

        if (path.includes(':')) path = path.split(':').join('/') + '.png';

        const iconset = path.split('/')[0];
        const icon = path.split('/').splice(1).join('/');

        selected.value = await std(`/api/iconset/${iconset}/icon/${encodeURIComponent(icon)}`) as Icon;
    }
}

async function fetchIconsets(): Promise<void> {
    loading.value.iconset = true;
    const url = stdurl('/api/iconset');
    url.searchParams.set('limit', '50');
    sets.value = (await std(url) as { total: number; items: Iconset[] }).items;
    if (sets.value.length) {
        params.value.iconset = sets.value[0].name;
    }
    loading.value.iconset = false;
}

async function fetchIcons(): Promise<void> {
    loading.value.icons = true;
    const url = stdurl('/api/icon');
    url.searchParams.set('limit', '1000');
    if (params.value.iconset) {
        const match = sets.value.find((set) => set.name === params.value.iconset);
        if (match) url.searchParams.set('iconset', match.uid);
    }
    url.searchParams.set('filter', params.value.filter);
    list.value = await std(url) as IconList;
    loading.value.icons = false;
}

</script>
