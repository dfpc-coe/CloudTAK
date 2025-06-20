<template>
    <div
        v-if='type'
        class='col-12'
    >
        <IconChartGridDots
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label class='subheader user-select-none'>Type</label>
        <div class='mx-2'>
            <div
                v-if='!hover'
                class='bg-gray-500 rounded-top py-2 px-2 text-truncate d-flex align-items-center'
            >
                <FeatureIcon
                    :key='type'
                    :feature='{ properties: { icon: type } }'
                />

                <div
                    class='mx-2'
                    v-text='meta ? meta.full : type'
                />

                <div
                    v-if='meta'
                    class='ms-auto'
                    v-text='`(${type})`'
                />
            </div>
            <TablerDropdown v-else>
                <div
                    class='bg-gray-500 rounded-top py-2 px-2 text-truncate d-flex align-items-center'
                    :class='{
                        "hover-button hover-border cursor-pointer": hover,
                    }'
                >
                    <FeatureIcon
                        :key='type'
                        :feature='{ properties: { icon: type } }'
                    />

                    <div
                        class='mx-2'
                        v-text='meta ? meta.full : type'
                    />

                    <div
                        v-if='meta'
                        class='ms-auto'
                        v-text='`(${type})`'
                    />
                </div>

                <template #dropdown>
                    <div
                        class='rounded border border-white px-2 py-2'
                        style='width: 384px;'
                    >
                        <div class='row g-2'>
                            <div class='col-8'>
                                <TablerInput
                                    v-model='paging.filter'
                                    icon='search'
                                    placeholder='Filter'
                                    :autofocus='true'
                                />
                            </div>
                            <div class='col-4'>
                                <TablerEnum
                                    v-model='paging.identity'
                                    :default='StandardIdentity.FRIENDLY'
                                    :options='Object.keys(StandardIdentity)'
                                />
                            </div>
                        </div>

                        <template v-for='item of list.items'>
                            <div
                                class='d-flex align-items-center px-2 py-2 hover-dark cursor-pointer rounded'
                                @click='updateType(item)'
                            >
                                <FeatureIcon
                                    :feature='{ properties: { icon: item.cot.replace(/^a-\.-/, "a-u-") } }'
                                />

                                <div
                                    class='mx-2'
                                    v-text='item.full'
                                />
                            </div>
                        </template>
                    </div>
                </template>
            </TablerDropdown>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import type { COTType, COTTypeList } from '../../../types.ts';
import FeatureIcon from './FeatureIcon.vue';
import {
    IconChartGridDots
} from '@tabler/icons-vue';
import {
    TablerEnum,
    TablerInput,
    TablerDropdown
} from '@tak-ps/vue-tabler';

const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    hover: {
        type: Boolean,
        default: true
    }
})

const emit = defineEmits(['update:modelValue']);

const meta = ref<COTType | undefined>();
const type = ref(props.modelValue);
const loading = ref(true);
const StandardIdentity: Record<string, string> = {
    'PENDING': 'p',
    'UNKNOWN': 'u',
    'ASSUMED_FRIEND': 'a',
    'FRIEND': 'f',
    'NEUTRAL': 'n',
    'SUSPECT': 's',
    'HOSTILE': 'h',
    'JOKER': 'j',
    'FAKER': 'k',
    'NONE': 'o'
}

const paging = ref({
    filter: '',
    identity: 'FRIEND'
});

const list = ref<COTTypeList>({
    total: 0,
    items: []
});

watch(type, () => {
    emit('update:modelValue', type.value);
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchType();
    await fetchList();
});

function updateType(item: COTType) {
    meta.value = item;
    type.value = item.cot;
}

async function fetchType() {
    const url = stdurl(`/api/type/cot/${type.value}`);
    meta.value = await std(url) as COTType;
}

async function fetchList() {
    loading.value = true;

    const url = stdurl('/api/type/cot');
    url.searchParams.append('filter', paging.value.filter);
    url.searchParams.append('identity', StandardIdentity[paging.value.identity]);

    list.value = await std(url) as COTTypeList;
}

</script>
