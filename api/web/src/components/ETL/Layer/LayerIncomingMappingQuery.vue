<template>
    <div>
        <div class='card-header d-flex align-items-center'>
            <TablerIconButton
                :title='`Back to ${schema} Queries`'
                @click='back'
            >
                <IconArrowLeft
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <h3 class='card-title mx-2'>
                {{ isNew ? 'New Query' : 'Edit Query' }}
            </h3>
            <div
                v-if='!loading'
                class='ms-auto btn-list'
            >
                <TablerDelete
                    v-if='!isNew'
                    displaytype='icon'
                    title='Delete Query'
                    @delete='remove'
                />
                <button
                    class='btn btn-primary btn-icon px-2'
                    title='Save Query'
                    :disabled='!valid'
                    @click='save'
                >
                    <IconDeviceFloppy
                        :size='32'
                        stroke='1'
                    />
                </button>
            </div>
        </div>

        <TablerLoading
            v-if='loading'
            :desc='loading'
        />
        <TablerNone
            v-else-if='!isNew && !existing'
            label='Query'
            :create='false'
        />
        <template v-else>
            <div class='row g-2 px-2 pb-2'>
                <div class='col-12'>
                    <TablerInput
                        v-model='query.name'
                        label='Name'
                        description='Human readable name of the query'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-model='query.destination'
                        label='Destination'
                        description='CloudTAK type the matched records are converted into'
                        :options='destinations'
                    />
                </div>
                <div class='col-12'>
                    <TablerToggle
                        v-model='isDefault'
                        label='Default Query'
                        description='Match every record of the schema instead of filtering with a JSONata query'
                    />
                </div>
                <div
                    v-if='!isDefault'
                    class='col-12'
                >
                    <QueryInput
                        v-model='query.query'
                        label='Query'
                        description='JSONata query evaluated against each record - records it matches are mapped'
                        placeholder='status = "offline"'
                    />
                </div>
                <div class='col-12'>
                    <component
                        :is='mappers[query.destination]'
                        v-model='mapping'
                        :schema='outputSchema ?? { properties: {} }'
                    />
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import type { Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { server } from '../../../std.ts';
import type { ETLLayer, ETLLayerTaskCapabilities } from '../../../types.ts';
import {
    TablerNone,
    TablerEnum,
    TablerInput,
    TablerToggle,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-vue';
import { outputSchemas } from './utils/namedSchemas.ts';
import QueryInput from './utils/QueryInput.vue';
import CoreFeature from './Mapping/CoreFeature.vue';
import CoreEvent from './Mapping/CoreEvent.vue';
import CoreDevice from './Mapping/CoreDevice.vue';

type LayerMap = NonNullable<ETLLayer['incoming']>['maps'][number];
type Destination = LayerMap['destination'];

type QueryForm = {
    name: string;
    destination: Destination;
    query: string;
};

const props = defineProps<{
    layer: ETLLayer;
    capabilities: ETLLayerTaskCapabilities;
}>();

const emit = defineEmits<{
    (e: 'refresh'): void;
}>();

const route = useRoute();
const router = useRouter();

const loading = ref<string | false>(false);

const destinations: Destination[] = ['CoreFeature', 'CoreEvent', 'CoreDevice'];
const mappers: Record<Destination, Component> = { CoreFeature, CoreEvent, CoreDevice };

const schema = computed(() => String(route.params.schema));
const outputSchema = computed(() => outputSchemas(props.capabilities).find((s) => s.id === schema.value)?.schema);
const isNew = computed(() => route.name === 'layer-incoming-mapping-query-new');

/** The query addressed by the route along with the destination of its Map */
const existing = computed(() => {
    if (isNew.value) return undefined;

    const id = Number(route.params.query);

    for (const map of props.layer.incoming?.maps ?? []) {
        if (map.schema !== schema.value) continue;

        const match = map.queries.find((q) => q.id === id);
        if (match) return { ...match, destination: map.destination };
    }

    return undefined;
});

const query = ref<QueryForm>({
    name: existing.value?.name ?? '',
    destination: existing.value?.destination ?? 'CoreFeature',
    query: existing.value?.query ?? '',
});

const isDefault = ref(existing.value ? existing.value.query === null : true);

const mapping = ref<Record<string, unknown>>(JSON.parse(JSON.stringify(existing.value?.map ?? {})));

const valid = computed(() => query.value.name.trim().length > 0 && (isDefault.value || query.value.query.trim().length > 0));

watch(isDefault, (value) => {
    if (value) query.value.query = '';
});

function pathParams() {
    return {
        ':connectionid': Number(route.params.connectionid),
        ':layerid': Number(route.params.layerid),
    };
}

async function save() {
    loading.value = 'Saving Query';

    try {
        const body = {
            name: query.value.name,
            destination: query.value.destination,
            query: isDefault.value ? null : query.value.query,
            mapping: mapping.value,
        };

        if (isNew.value) {
            const res = await server.POST('/api/connection/{:connectionid}/layer/{:layerid}/incoming/mapping', {
                params: { path: pathParams() },
                body: { ...body, schema: schema.value },
            });
            if (res.error) throw new Error(res.error.message);
        } else {
            const res = await server.PATCH('/api/connection/{:connectionid}/layer/{:layerid}/incoming/mapping/{:mappingid}', {
                params: { path: { ...pathParams(), ':mappingid': Number(route.params.query) } },
                body,
            });
            if (res.error) throw new Error(res.error.message);
        }

        emit('refresh');
        back();
    } finally {
        loading.value = false;
    }
}

async function remove() {
    loading.value = 'Deleting Query';

    try {
        const res = await server.DELETE('/api/connection/{:connectionid}/layer/{:layerid}/incoming/mapping/{:mappingid}', {
            params: { path: { ...pathParams(), ':mappingid': Number(route.params.query) } },
        });
        if (res.error) throw new Error(res.error.message);

        emit('refresh');
        back();
    } finally {
        loading.value = false;
    }
}

function back() {
    router.push({
        name: 'layer-incoming-mapping-schema',
        params: {
            connectionid: route.params.connectionid,
            layerid: route.params.layerid,
            schema: schema.value,
        },
    });
}
</script>
