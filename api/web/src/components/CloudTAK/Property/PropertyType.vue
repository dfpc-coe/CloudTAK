<template>
    <div v-if='config.type'>
        <template v-if='!props.edit'>
            <div
                class='rounded py-2 px-2 text-truncate d-flex align-items-center user-select-none'
                :class='background'
            >
                <FeatureIcon
                    :key='config.type'
                    :feature='{ properties: { icon: headerIcon } }'
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
                        :feature='{ properties: { icon: headerIcon } }'
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
                    <div
                        v-if='availableStandards.length > 1'
                        class='row g-2 mb-2'
                    >
                        <div class='col-12'>
                            <div
                                class='btn-group w-100'
                                role='group'
                            >
                                <button
                                    v-for='std of availableStandards'
                                    :key='std'
                                    type='button'
                                    class='btn btn-sm'
                                    :class='{
                                        "btn-primary": standard === std,
                                        "btn-outline-secondary": standard !== std
                                    }'
                                    @click='standard = std'
                                    v-text='std'
                                />
                            </div>
                        </div>
                    </div>
                    <div class='row g-2'>
                        <div
                            :class='{
                                "col-12": standard === "2525B" && !config.type.startsWith("a-"),
                                "col-8": standard === "2525E" || config.type.startsWith("a-")
                            }'
                        >
                            <TablerInput
                                v-model='paging.filter'
                                icon='search'
                                placeholder='Filter'
                            />
                        </div>
                        <div
                            v-if='standard === "2525E" || config.type.startsWith("a-")'
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

                    <div
                        class='overflow-y-auto'
                        style='max-height: 18rem;'
                    >
                        <TablerLoading
                            v-if='loading'
                        />
                        <template v-else-if='standard === "2525B"'>
                            <TablerNone
                                v-if='list.total === 0'
                                label='No Types Found'
                                :create='false'
                            />
                            <template v-else>
                                <template
                                    v-for='item of list.items'
                                >
                                    <div
                                        class='d-flex align-items-center px-2 py-2 cloudtak-hover cursor-pointer rounded'
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
                        <template v-else-if='standard === "2525E"'>
                            <!-- Tree browsing: Symbol Set => Entity => Entity Type => Entity Subtype -->
                            <template v-if='!paging.filter'>
                                <div class='d-flex align-items-center px-2 py-1 user-select-none'>
                                    <TablerIconButton
                                        v-if='crumbs.length'
                                        title='Back'
                                        @click='popCrumb'
                                    >
                                        <IconChevronLeft
                                            :size='20'
                                            stroke='1'
                                        />
                                    </TablerIconButton>

                                    <div
                                        class='mx-2 subheader text-truncate'
                                        v-text='crumbLabel'
                                    />
                                </div>

                                <template v-if='crumbs.length === 0'>
                                    <div
                                        v-for='set of list2525E.symbolsets'
                                        :key='set.id'
                                        class='d-flex align-items-center px-2 py-2 cloudtak-hover cursor-pointer rounded'
                                        @click='pushCrumb({ id: set.id, name: set.name })'
                                    >
                                        <IconFolder
                                            :size='20'
                                            stroke='1'
                                        />

                                        <div
                                            class='mx-2 text-truncate'
                                            v-text='set.name'
                                        />

                                        <div class='ms-auto'>
                                            <IconChevronRight
                                                :size='16'
                                                stroke='1'
                                            />
                                        </div>
                                    </div>
                                </template>
                                <template v-else>
                                    <TablerNone
                                        v-if='list2525E.total === 0'
                                        label='No Symbols Found'
                                        :create='false'
                                    />
                                    <template v-else>
                                        <div
                                            v-for='item of list2525E.items'
                                            :key='item.sidc'
                                            class='d-flex align-items-center px-2 py-2 cloudtak-hover cursor-pointer rounded'
                                            :title='item.remarks'
                                            @click='updateType2525E(item)'
                                        >
                                            <FeatureIcon
                                                :key='item.sidc'
                                                :feature='{ properties: { icon: `2525E:${item.sidc}` } }'
                                            />

                                            <div
                                                class='mx-2 text-truncate'
                                                v-text='item.title'
                                            />

                                            <TablerIconButton
                                                v-if='item.children'
                                                class='ms-auto'
                                                :title='`${item.children} Subtypes`'
                                                @click.stop='pushCrumb({ id: entityCode(item), name: item.title })'
                                            >
                                                <IconChevronRight
                                                    :size='16'
                                                    stroke='1'
                                                />
                                            </TablerIconButton>
                                        </div>
                                    </template>
                                </template>
                            </template>
                            <!-- Filter set: flat search across all Symbol Sets -->
                            <template v-else>
                                <TablerNone
                                    v-if='list2525E.total === 0'
                                    label='No Types Found'
                                    :create='false'
                                />
                                <template v-else>
                                    <template
                                        v-for='item of list2525E.items'
                                    >
                                        <div
                                            class='d-flex align-items-center px-2 py-2 cloudtak-hover cursor-pointer rounded'
                                            :title='item.remarks'
                                            @click='updateType2525E(item)'
                                        >
                                            <FeatureIcon
                                                :key='item.sidc'
                                                :feature='{ properties: { icon: `2525E:${item.sidc}` } }'
                                            />

                                            <div
                                                class='mx-2'
                                                v-text='item.name'
                                            />
                                        </div>
                                    </template>
                                </template>
                            </template>
                        </template>
                    </div>
                </template>
            </template>
        </TablerSlidedown>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, computed, onMounted } from 'vue';
import { server } from '../../../std.ts';
import Type2525, { SID_MAP, SID_REVERSE_MAP } from '@tak-ps/node-cot/2525';
import type { COTType, COTTypeList, COT2525EList, COT2525EType } from '../../../types.ts';
import FeatureIcon from '../util/FeatureIcon.vue';
import {
    IconFolder,
    IconChevronLeft,
    IconChevronRight,
    IconChartGridDots
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerEnum,
    TablerInput,
    TablerLoading,
    TablerSlidedown,
    TablerIconButton,
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
} else if (Type2525.isNumericSIDCConvertable(config.value.type)) {
    config.value.affiliation = SID_REVERSE_MAP[config.value.type.substring(2, 4)] || 'u';
}

const loading = ref(true);

const paging = ref({
    filter: '',
});

const standards = ['2525B', '2525E'] as const;
const standard = ref<typeof standards[number]>(
    Type2525.isNumericSIDCConvertable(props.modelValue) ? '2525E' : '2525B'
);

// Once a Feature has been converted to a 2525E type there is no going back
// to the (less expressive) 2525B CoT type tree
const availableStandards = computed<Array<typeof standards[number]>>(() => {
    return Type2525.isNumericSIDCConvertable(config.value.type)
        ? ['2525E']
        : [...standards];
});

watch(availableStandards, () => {
    if (!availableStandards.value.includes(standard.value)) {
        standard.value = '2525E';
    }
});

const headerIcon = computed<string>(() => {
    return Type2525.isNumericSIDCConvertable(config.value.type)
        ? `2525E:${config.value.type}`
        : config.value.type;
});

const list = ref<COTTypeList>({
    total: 0,
    items: []
});

const list2525E = ref<COT2525EList>({
    total: 0,
    symbolsets: [],
    items: []
});

// Tree browsing path - crumbs[0] is the Symbol Set, deeper crumbs are Entity Codes
const crumbs = ref<Array<{ id: string; name: string }>>([]);

const crumbLabel = computed(() => {
    if (!crumbs.value.length) return 'Symbol Sets';
    return crumbs.value.map((crumb) => crumb.name).join(' / ');
});

watch(standard, async () => {
    await fetchList();
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
        } else if (Type2525.isNumericSIDCConvertable(props.modelValue)) {
            const affiliation = SID_REVERSE_MAP[props.modelValue.substring(2, 4)] || 'u';

            if (affiliation !== config.value.affiliation) {
                config.value.affiliation = affiliation;
                await fetchList();
            }
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
        return 'border border-blue bg-blue-lt';
    } else if (config.value.affiliation === 'n') {
        return 'border border-green bg-green-lt';
    } else if (config.value.affiliation === 'h' || config.value.affiliation === 's' || config.value.affiliation === 'j' || config.value.affiliation === 'k') {
        return 'border border-red bg-red-lt';
    } else if (config.value.affiliation === 'p') {
        return 'border border-yellow bg-yellow-lt';
    } else {
        return 'cloudtak-accent';
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

function entityCode(item: COT2525EType): string {
    return item.sidc.substring(10, 16);
}

async function pushCrumb(crumb: { id: string; name: string }) {
    crumbs.value.push(crumb);
    await fetchList();
}

async function popCrumb() {
    crumbs.value.pop();
    await fetchList();
}

function updateType2525E(item: COT2525EType) {
    meta.value = {
        cot: item.sidc,
        full: item.name,
        desc: item.remarks
    };

    config.value.type = item.sidc;

    // The numeric SIDC is emitted as the type - node-cot's from_geojson maps
    // it to a basic CoT type + milicon detail at the CoT boundary
    emit('update:modelValue', item.sidc);
}

async function updateAffiliation(affil: string) {
    if (StandardAffiliation[affil] === undefined) return;

    config.value.affiliation = StandardAffiliation[affil]

    if (Type2525.isNumericSIDCConvertable(config.value.type)) {
        const sid = SID_MAP[config.value.affiliation.toUpperCase()] || '01';
        config.value.type = config.value.type.substring(0, 2) + sid + config.value.type.substring(4);
    } else {
        config.value.type = config.value.type.replace(/^a-.-/, `a-${config.value.affiliation}-`);
    }

    emit('update:modelValue', config.value.type);

    await fetchList();
}

async function fetchType() {
    if (Type2525.isNumericSIDCConvertable(config.value.type)) {
        const { data, error } = await server.GET('/api/type/2525e/{:sidc}', {
            params: {
                path: {
                    ':sidc': config.value.type
                }
            }
        });

        if (error) throw new Error(String(error));

        meta.value = {
            cot: data.sidc,
            full: data.name,
            desc: data.remarks
        };
    } else {
        const { data, error } = await server.GET('/api/type/cot/{:type}', {
            params: {
                path: {
                    ':type': config.value.type
                }
            }
        });

        if (error) throw new Error(String(error));
        meta.value = data;
    }
}

async function fetchList() {
    loading.value = true;

    try {
        if (standard.value === '2525E') {
            const query: {
                filter: string;
                identity: string;
                limit: number;
                symbolset?: string;
                parent?: string;
            } = {
                filter: paging.value.filter,
                identity: config.value.affiliation,
                limit: 100
            };

            // Tree browsing only applies when not searching
            if (!paging.value.filter && crumbs.value.length) {
                query.symbolset = crumbs.value[0].id;

                if (crumbs.value.length > 1) {
                    query.parent = crumbs.value[crumbs.value.length - 1].id;
                }
            }

            const { data, error } = await server.GET('/api/type/2525e', {
                params: {
                    // @ts-expect-error Types are loose
                    query
                }
            });

            if (error) throw new Error(String(error));
            list2525E.value = data;
        } else {
            const { data, error } = await server.GET('/api/type/cot', {
                params: {
                    query: {
                        filter: paging.value.filter,
                        // @ts-expect-error Types are loose
                        identity: config.value.affiliation,
                        domain: 'a',
                        limit: 100
                    }
                }
            });

            if (error) throw new Error(String(error));
            list.value = data;
        }
    } finally {
        loading.value = false;
    }
}

</script>
