<template>
    <div
        v-if='config.type'
        class='mx-2'
    >
        <TablerSlidedown
            :clickAnywhereExpand='true'
        >
            <IconChartGridDots
                :size='18'
                stroke='1'
                color='#6b7990'
                class='ms-2 me-1'
            />
            <label class='subheader user-select-none'>Type</label>
            <div class='mx-2'>
                <div class='bg-gray-500 rounded-top py-2 px-2 text-truncate d-flex align-items-center user-select-none'>
                    <FeatureIcon
                        :key='config.type'
                        :feature='{ properties: { icon: config.type } }'
                    />

                    <div
                        class='mx-2 text-truncate'
                        v-text='meta ? meta.full : config.type'
                    />
                </div>
            </div>

            <template #expanded>
                <template v-if='config.type.startsWith("u-") && config.type !== "u-d-p"'>
                    <div class='mb-2'>
                        <TablerInlineAlert
                            title='User Drawn Feature'
                            description='Cannot be changed'
                        />
                    </div>
                </template>
                <template v-else>
                    <div class='row g-2'>
                        <div class='col-12'>
                            <TablerEnum
                                v-if='config.type.startsWith("a-")'
                                :modelValue='StandardAffiliationInverse[config.affiliation]'
                                :default='StandardAffiliation.Friendly'
                                :options='Object.keys(StandardAffiliation)'
                                @update:modelValue='config.affiliation = StandardAffiliation[$event]'
                            />
                        </div>
                        <div class='col-12'>
                            <TablerInput
                                v-model='paging.filter'
                                icon='search'
                                placeholder='Filter'
                                :autofocus='true'
                            />
                        </div>
                    </div>

                    <template v-for='item of list.items'>
                        <div
                            class='d-flex align-items-center px-2 py-2 hover cursor-pointer rounded'
                            @click='updateType(item)'
                        >
                            <FeatureIcon
                                :key='item.cot'
                                :feature='{ properties: { icon: item.cot } }'
                            />

                            <div
                                class='mx-2'
                                v-text='item.full'
                            />
                        </div>
                    </template>
                </template>
            </template>
        </TablerSlidedown>
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
    TablerSlidedown,
    TablerInlineAlert,
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

const config = ref({
    affiliation: props.modelValue.split('-')[1],
    type: props.modelValue
})

const loading = ref(true);

const StandardAffiliation: Record<string, string> = {
    'Pending': 'p',
    'Assumed Friendly': 'a',
    'Friendly': 'f',
    'Neutral': 'n',
    'Suspect': 's',
    'Hostile': 'h',
    'Joker': 'j',
    'Faker': 'k',
    'Unknown': 'u',
    'None': 'o'
}

const StandardAffiliationInverse = Object.fromEntries(
    Object.entries(StandardAffiliation).map(([key, value]) => [value, key])
);

const paging = ref({
    filter: '',
});

const list = ref<COTTypeList>({
    total: 0,
    items: []
});

watch(props, async () => {
    if (!props.modelValue) return;

    if (props.modelValue !== config.value.type) {
        config.value.affiliation = props.modelValue.split('-')[1];
        config.value.type = props.modelValue;

        await fetchType();
        await fetchList();
    }
});

watch(config.value, async () => {
    if (config.value.type.split(['-'])[1] !== config.value.affiliation) {
        config.value.type = config.value.type.replace(/^.-.-/, `a-${config.value.affiliation}-`);
    }

    emit('update:modelValue', config.value.type);

    await fetchType();
    await fetchList();
}, {
    deep: true
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
    config.value.type = item.cot;
}

async function fetchType() {
    const url = stdurl(`/api/type/cot/${config.value.type}`);
    meta.value = await std(url) as COTType;
}

async function fetchList() {
    loading.value = true;

    const url = stdurl('/api/type/cot');
    url.searchParams.append('filter', paging.value.filter);

    if (config.value.type.startsWith('a-')) {
        url.searchParams.append('identity', config.value.affiliation);
    } else {
        url.searchParams.append('identity', 'f');
    }

    url.searchParams.append('domain', 'a');

    list.value = await std(url) as COTTypeList;
}

</script>
