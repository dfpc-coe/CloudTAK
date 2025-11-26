<template>
    <div
        data-bs-theme='dark'
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
                    :label='label || placeholder'
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
            label='Iconsets Loaded'
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
                                        :color='params.showFilter ? "#83b7e8" : "#ffffff"'
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

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { std, stdurl } from '/src/std.ts';
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

const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    required: {
        type: Boolean,
        default: false
    },
    disabled: {
        type: Boolean,
        default: false
    },
    label: {
        type: String,
        default: 'Icon Select'
    }
});

const emit = defineEmits([
    'update:modelValue'
]);

const help = ref(false);

const loading = ref({
   iconsets: true,
   icons: true
});

const params = ref({
    iconset: '',
    showFilter: false,
    filter: '',
});

const selected = ref({
    iconset: false,
    path: '',
    name: ''
})

const sets = ref([]);
const list = ref({
    total: 0,
    items: []
});

const setsName = computed(() => {
    return sets.value.map((set) => { return set.name });
});

watch(selected, () => {
    if (selected.value.path.endsWith('.png')) {
        emit('update:modelValue', selected.value.path);
    } else {
        // Replace any extension with PNG for sprites
        emit('update:modelValue', selected.value.path.replace(/\.[^/.]+$/, ".png"));
    }
}, { deep: true })

watch(params.value, async () => {
    await Iconlists();
});

watch(props.modelValue, async () => {
    await fetch();
});

onMounted(async () => {
    await fetch();
    await Iconlistsets();
    await Iconlists();
});

function removeIcon() {
    selected.value.path = '';
    selected.value.iconset = false;
    selected.value.name = '';
}

async function fetch() {
    // This is unfortuante but the CloudTAK Map uses the MapLibre Icon format
    // While the backend uses the TAK Icon Format
    if (
        props.modelValue
        && !props.modelValue.startsWith('2525')
        && (
            props.modelValue.includes(":")
            || props.modelValue.split('/').length === 3
        )
    ) {
        let path = props.modelValue;

        // MapLibre needs the palette name seperated by a ":" instead of a "/"
        if (path.includes(':')) path = path.split(':').join('/') + '.png';

        const iconset = path.split('/')[0];
        const icon = path.split('/').splice(1).join('/');

        selected.value = await std(`/api/iconset/${iconset}/icon/${encodeURIComponent(icon)}`);
    }
}

async function Iconlistsets() {
    loading.value.iconsets = true;
    const url = stdurl('/api/iconset');
    url.searchParams.append('limit', 50);
    sets.value = (await std(url)).items;
    if (sets.value.length) {
        params.value.iconset = sets.value[0].name;
    }
    loading.value.iconsets = false;
}

async function Iconlists() {
    loading.value.icons = true;
    let url = stdurl(`/api/icon`);
    url.searchParams.append('limit', 1000);
    if (params.value.iconset) {
        const id = sets.value.filter((set) => {
            return set.name === params.value.iconset;
        })[0];

        if (id) url.searchParams.append('iconset', id.uid);
    }

    url.searchParams.append('filter', params.value.filter);
    list.value = await std(url)
    loading.value.icons = false;
}
</script>
