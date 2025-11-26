<template>
    <div v-if='config.type'>
        <template v-if='!props.edit'>
            <div
                class='rounded py-2 px-2 text-truncate d-flex align-items-center user-select-none'
                :class='background'
            >
                <FeatureIcon
                    :key='config.type'
                    :feature='{ properties: { icon: config.type } }'
                />

                <div
                    class='mx-2 text-truncate'
                    v-text='meta ? meta.full : config.type'
                />
            </div>
        </template>
        <TablerSlidedown
            v-else
            :click-anywhere-expand='true'
        >
            <IconChartGridDots
                :size='18'
                stroke='1'
                color='#6b7990'
                class='ms-2 me-1'
            />
            <label class='subheader user-select-none'>Type</label>
            <div class='mx-2 mt-1'>
                <div
                    class='rounded py-2 px-2 text-truncate d-flex align-items-center user-select-none'
                    :class='background'
                >
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
                        <div
                            :class='{
                                "col-12": !config.type.startsWith("a-"),
                                "col-8": config.type.startsWith("a-")
                            }'
                        >
                            <TablerInput
                                v-model='paging.filter'
                                icon='search'
                                placeholder='Filter'
                                :autofocus='true'
                            />
                        </div>
                        <div
                            v-if='config.type.startsWith("a-")'
                            class='col-4'
                        >
                            <TablerEnum
                                :model-value='StandardAffiliationInverse[config.affiliation]'
                                :default='StandardAffiliation.Friendly'
                                :options='Object.keys(StandardAffiliation)'
                                @update:model-value='updateAffiliation($event)'
                            />
                        </div>
                    </div>

                    <TablerLoading
                        v-if='loading'
                    />
                    <TablerNone
                        v-else-if='list.total === 0'
                        label='Types Found'
                        :create='false'
                    />
                    <template v-else>
                        <template
                            v-for='item of list.items'
                        >
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
            </template>
        </TablerSlidedown>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, computed, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import type { COTType, COTTypeList } from '../../../types.ts';
import FeatureIcon from './FeatureIcon.vue';
import {
    IconChartGridDots
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerEnum,
    TablerInput,
    TablerLoading,
    TablerSlidedown,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';

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

const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    edit: {
        type: Boolean,
        default: true
    }
})

const emit = defineEmits(['update:modelValue']);

const meta = ref<COTType | undefined>();

const config = ref({
    affiliation: 'u',
    type: props.modelValue
})

if (config.value.type.startsWith('a-') && StandardAffiliationInverse[config.value.type.split('-')[1]]) {
    config.value.affiliation = config.value.type.split('-')[1];
}

const loading = ref(true);

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
        if (
            props.modelValue.startsWith('a-')
            && StandardAffiliationInverse[props.modelValue.split('-')[1]]
            && config.value.affiliation !== props.modelValue.split('-')[1]
        ) {
            config.value.affiliation = config.value.type.split('-')[1];
            await fetchList();
        } else if (props.modelValue.startsWith('u-')) {
            config.value.affiliation = 'u';
        }

        config.value.type = props.modelValue;

        await fetchType();
    }
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchType();
    await fetchList();
});

const background = computed(() => {
    if (config.value.affiliation === 'f' || config.value.affiliation === 'a') {
        return 'border border-blue bg-blue-lt text-blue-fg';
    } else if (config.value.affiliation === 'n') {
        return 'border border-green bg-green-lt text-green-fg';
    } else if (config.value.affiliation === 'h' || config.value.affiliation === 's' || config.value.affiliation === 'j' || config.value.affiliation === 'k') {
        return 'border border-red bg-red-lt text-red-fg';
    } else if (config.value.affiliation === 'p') {
        return 'border border-yellow bg-yellow-lt text-yellow-fg';
    } else {
        return 'bg-accent';
    }
});

function updateType(item: COTType) {
    meta.value = item;

    const type = item.cot.split('-');
    if (type[0] === 'a') {
        type[1] = config.value.affiliation;
    }

    config.value.type = type.join('-');

    emit('update:modelValue', item.cot);
}

async function updateAffiliation(affil: string) {
    if (StandardAffiliation[affil] === undefined) return;

    config.value.affiliation = StandardAffiliation[affil]
    config.value.type = config.value.type.replace(/^a-.-/, `a-${config.value.affiliation}-`);

    emit('update:modelValue', config.value.type);

    await fetchList();
}

async function fetchType() {
    const url = stdurl(`/api/type/cot/${config.value.type}`);
    meta.value = await std(url) as COTType;
}

async function fetchList() {
    loading.value = true;

    const url = stdurl('/api/type/cot');
    url.searchParams.append('filter', paging.value.filter);

    url.searchParams.append('identity', config.value.affiliation);
    url.searchParams.append('domain', 'a');

    list.value = await std(url) as COTTypeList;

    loading.value = false;
}

</script>
