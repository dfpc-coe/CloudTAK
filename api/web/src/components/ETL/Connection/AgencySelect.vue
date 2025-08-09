<template>
    <div>
        <div class='d-flex align-items-center'>
            <label class='mx-1 mb-1'>Connection Agency</label>
            <div
                v-if='isSystemAdmin'
                class='ms-auto'
            >
                <TablerToggle
                    v-model='noAgency'
                    label='System Admin Connection - No Owning Agency'
                />
            </div>
        </div>
        <div class='card'>
            <template v-if='noAgency'>
                <TablerNone
                    :create='false'
                    :compact='true'
                    label='Agency - System Admin Access Only'
                />
            </template>
            <template v-else>
                <div class='card-body'>
                    <TablerLoading
                        v-if='loading.main'
                        :inline='true'
                        desc='Loading Agencies'
                    />
                    <template v-else-if='selected'>
                        <div class='col-12 d-flex align-items-center'>
                            <div v-text='selected.name' />
                            <div class='ms-auto'>
                                <TablerIconButton
                                    v-if='selected && list.total > 1'
                                    title='Remove Agency'
                                    @click='selected = undefined'
                                >
                                    <IconTrash
                                        :size='32'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <div class='col-12 pb-2'>
                            <TablerInput
                                v-model='filter'
                                icon='search'
                                placeholder='Agency Filter...'
                            />
                        </div>

                        <TablerLoading
                            v-if='loading.list'
                            desc='Loading Agencies'
                        />
                        <TablerNone
                            v-else-if='list.total === 0'
                            :create='false'
                            :compact='true'
                            label='Agencies'
                        />
                        <template v-else>
                            <div
                                v-for='agency in list.items'
                                :key='agency.id'
                                class='hover px-2 py-2 cursor-pointer row rounded col-12'
                                @click='selected = agency'
                            >
                                <div class='d-flex align-items-center'>
                                    <IconHome
                                        :size='32'
                                        stroke='1'
                                    />
                                    <span
                                        class='mx-2'
                                        v-text='agency.name'
                                    />
                                </div>
                            </div>
                        </template>
                    </template>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import type { Profile, ETLAgencyList, ETLAgency } from '../../../types.ts';
import { watchDebounced } from '@vueuse/core'
import {
    IconTrash,
    IconHome,
} from '@tabler/icons-vue';
import {
    TablerIconButton,
    TablerLoading,
    TablerToggle,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    modelValue: number | null,
}>()

const emit = defineEmits([ 'update:modelValue' ]);

const noAgency = ref(props.modelValue === null);
const loading = ref({
    main: true,
    list: true,
});
const filter = ref('');
const selected = ref<ETLAgency | undefined>(undefined);
const isSystemAdmin = ref(false);

const list =  ref<ETLAgencyList>({
    total: 0,
    items: []
});

watch(selected, () => {
    if (!noAgency.value) {
        emit('update:modelValue', selected.value ? selected.value.id : undefined);
    }
});

watch(noAgency, () => {
    if (noAgency.value) {
        selected.value = undefined;
        emit('update:modelValue', null);
    }
});

watchDebounced(filter, async function() {
    await listData()
}, { debounce: 500 })

watch(props, async (newProps, oldProps) => {
    if (newProps.modelValue !== oldProps.modelValue) {
        await fetch();
    }
})

onMounted(async () => {
    const profile = await std('/api/profile') as Profile;
    isSystemAdmin.value = profile.system_admin;

    if (props.modelValue) await fetch();
    await listData();
    loading.value.main = false;
});

async function fetch() {
    selected.value = await std(`/api/agency/${props.modelValue}`) as ETLAgency;
}

async function listData() {
    loading.value.list = true;
    const url = stdurl('/api/agency');
    url.searchParams.append('filter', filter.value);
    const data = await std(url) as ETLAgencyList;

    if (!isSystemAdmin.value && data.total === 1) {
        selected.value = data.items[0];
    }

    list.value = data;

    loading.value.list = false;
}
</script>
