<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Config
            </h3>
            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='disabled && featureSubscribed'
                    title='Edit Layer Config'
                    @click='disabled = false'
                >
                    <IconPencil
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>

        <TablerLoading
            v-if='loading.save'
            desc='Saving Config'
        />
        <TablerLoading
            v-else-if='loading.init'
            desc='Loading Config'
        />
        <div
            v-else
            class='card-body'
        >
            <div class='row g-2'>
                <div class='col-12'>
                    <label class='subheader'>Subscriptions</label>
                </div>
                <div class='col-12 border rounded'>
                    <TablerNone
                        v-if='!outgoing.subscriptions || outgoing.subscriptions.length === 0'
                        label='No Subscriptions'
                        :compact='true'
                        :create='false'
                    />
                    <template v-else>
                        <div
                            v-for='subscription in outgoing.subscriptions'
                            :key='subscription'
                            class='mx-2 my-2'
                        >
                            <code v-text='subscription' />
                            <div
                                v-if='descriptions.get(subscription)'
                                class='small text-secondary'
                                v-text='descriptions.get(subscription)'
                            />
                        </div>
                    </template>
                </div>

                <template v-if='featureSubscribed'>
                    <div class='col-12 d-flex align-items-center pt-3'>
                        <label class='subheader'>Exclusion Filters</label>
                        <div class='ms-auto'>
                            <TablerIconButton
                                v-if='!disabled'
                                title='Add Filter'
                                @click='addFilter'
                            >
                                <IconPlus
                                    :size='24'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </div>
                    <div class='col-12 border rounded'>
                        <TablerNone
                            v-if='!outgoing.filters || !outgoing.filters.queries || outgoing.filters.queries.length === 0'
                            label='No Exclusion Filters'
                            :compact='true'
                            :create='false'
                        />
                        <template v-else>
                            <template
                                v-for='(filter, filter_idx) of outgoing.filters.queries'
                                :key='outgoing.filters.queries.length + "-" + filter_idx'
                            >
                                <div class='row mx-2 my-2 border-bottom pb-2'>
                                    <div
                                        v-if='!disabled'
                                        class='col-md-4 col-12'
                                    >
                                        <TablerInput
                                            v-model='filter.name'
                                            label='Name'
                                            placeholder='Optional Name'
                                            :disabled='disabled'
                                        />
                                    </div>
                                    <div
                                        class='col-12'
                                        :class='{ "col-md-8": !disabled }'
                                    >
                                        <QueryInput
                                            v-model='filter.query'
                                            :label='disabled && filter.name ? filter.name : "Filter"'
                                            :disabled='disabled'
                                        >
                                            <TablerDelete
                                                v-if='!disabled'
                                                title='Delete Filter'
                                                :size='24'
                                                displaytype='icon'
                                                @delete='outgoing.filters.queries.splice(filter_idx, 1)'
                                            />
                                        </QueryInput>
                                    </div>
                                </div>
                            </template>
                        </template>
                    </div>

                    <div
                        v-if='!disabled'
                        class='col-12 pt-3 d-flex'
                    >
                        <button
                            class='btn'
                            @click='reload'
                        >
                            Cancel
                        </button>
                        <div class='ms-auto'>
                            <button
                                class='btn btn-primary'
                                @click='saveOutgoing'
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { server } from '../../../std.ts';
import type { ETLLayerOutgoing } from '../../../types.ts';
import {
    TablerIconButton,
    TablerLoading,
    TablerInput,
    TablerDelete,
    TablerNone
} from '@tak-ps/vue-tabler';
import QueryInput from './utils/QueryInput.vue';
import {
    IconPlus,
    IconPencil,
} from '@tabler/icons-vue'

const props = defineProps({
    layer: {
        type: Object,
        required: true
    },
    capabilities: {
        type: Object,
        required: true
    }
})

const route = useRoute();
const emit = defineEmits([
    'refresh',
    'stack'
]);

const disabled = ref(true);

const loading = ref({
    init: true,
    save: false
});

const outgoing = ref<ETLLayerOutgoing>(props.layer.outgoing);

// Descriptions of the declared Outgoing types from the task's static Capabilities document
const descriptions = ref<Map<string, string>>(new Map());

const featureSubscribed = computed(() => {
    return (outgoing.value.subscriptions || []).some((subscription) => subscription.startsWith('feature:'));
});

onMounted(async () => {
    reload();
    await loadDescriptions();
    loading.value.init = false;
})

function reload() {
    outgoing.value = props.layer.outgoing;
    disabled.value = true;
}

async function loadDescriptions() {
    const match = String(props.layer.task).match(/^(.+)-v([0-9]+\.[0-9]+\.[0-9]+)$/);
    if (!match) return;

    try {
        const res = await server.GET('/api/task/raw/{:task}/version/{:version}', {
            params: {
                path: {
                    ':task': match[1],
                    ':version': match[2]
                }
            }
        });

        if (res.error || !res.data.capabilities) return;

        const types = res.data.capabilities.invocations.outgoing?.types ?? [];
        descriptions.value = new Map(types.map((type) => [type.resource, type.description]));
    } catch (err) {
        console.error(err);
    }
}

function addFilter() {
    if (!outgoing.value.filters) outgoing.value.filters = {};
    if (!outgoing.value.filters.queries) outgoing.value.filters.queries = [];

    outgoing.value.filters.queries.push({
        name: '',
        query: ''
    })
}

async function saveOutgoing() {
    loading.value.save = true;

    try {
        const res = await server.PATCH('/api/connection/{:connectionid}/layer/{:layerid}/outgoing', {
            params: {
                path: {
                    ':connectionid': Number(route.params.connectionid),
                    ':layerid': Number(String(route.params.layerid))
                }
            },
            body: outgoing.value
        });

        if (res.error) throw new Error(res.error.message);

        outgoing.value = res.data as ETLLayerOutgoing;

        disabled.value = true;

        loading.value.save = false;

        emit('refresh');
        emit('stack');
    } catch (err) {
        loading.value.save = false;
        throw err;
    }
}
</script>
