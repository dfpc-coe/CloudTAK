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
                v-if='!loading && !error'
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
        <TablerAlert
            v-else-if='error'
            title='Query Error'
            :err='error'
        />
        <div
            v-else
            class='row g-2 px-2 pb-2'
        >
            <div class='col-12'>
                <TablerInput
                    v-model='form.name'
                    label='Name'
                    description='Human readable name of the query'
                />
            </div>
            <div class='col-12'>
                <TablerEnum
                    :model-value='form.destination'
                    label='Destination'
                    description='CloudTAK type the matched records are converted into'
                    :options='destinations'
                    @update:model-value='setDestination'
                />
            </div>
            <div class='col-12'>
                <TablerToggle
                    v-model='isDefault'
                    label='Default Query'
                    description='Fallback applied to records that match no query - the first Default Query in creation order wins, whatever its Destination'
                />
            </div>
            <div
                v-if='!isDefault'
                class='col-12'
            >
                <QueryInput
                    v-model='form.query'
                    label='Query'
                    description='JSONata query evaluated against each record - queries are mutually exclusive, a record is directed to the Destination of the first query it matches'
                    placeholder='status = "offline"'
                />
            </div>
            <div class='col-12'>
                <CoreFeature
                    v-if='form.destination === "CoreFeature"'
                    v-model='mapping'
                    :schema='outputSchema ?? { properties: {} }'
                />
                <MappingFields
                    v-else-if='definition'
                    :key='form.destination'
                    v-model='mapping'
                    :definition='definition'
                    :schema='outputSchema ?? { properties: {} }'
                />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { server } from '../../../std.ts';
import type { CoreSchema, ETLLayerMapping, ETLLayerTaskCapabilities } from '../../../types.ts';
import {
    TablerAlert,
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
import MappingFields from './Mapping/MappingFields.vue';

type Destination = ETLLayerMapping['destination'];

type QueryForm = {
    name: string;
    destination: Destination;
    query: string;
};

const props = defineProps<{
    capabilities: ETLLayerTaskCapabilities;
}>();

const route = useRoute();
const router = useRouter();

const loading = ref<string | false>(false);
const error = ref<Error | undefined>();

const destinations = ref<Destination[]>([]);
const definitions = ref<Partial<Record<Destination, CoreSchema>>>({});

const schema = computed(() => String(route.params.schema));
const outputSchema = computed(() => outputSchemas(props.capabilities).find((s) => s.id === schema.value)?.schema);
const isNew = computed(() => route.params.query === 'new');
const queryId = computed(() => Number(route.params.query));

const pathParams = computed(() => ({
    ':connectionid': Number(route.params.connectionid),
    ':layerid': Number(route.params.layerid),
}));

const form = ref<QueryForm>({
    name: '',
    destination: 'CoreFeature',
    query: '',
});

const isDefault = ref(true);

const mapping = ref<Record<string, unknown>>({});

onMounted(async () => {
    loading.value = 'Loading Query';

    try {
        await fetchSchemas();

        if (isNew.value) return;

        const res = await server.GET('/api/connection/{:connectionid}/layer/{:layerid}/incoming/mapping/{:mappingid}', {
            params: { path: { ...pathParams.value, ':mappingid': queryId.value } },
        });
        if (res.error) throw new Error(res.error.message);

        form.value = {
            name: res.data.name,
            destination: res.data.destination,
            query: res.data.query ?? '',
        };
        isDefault.value = res.data.query === null;
        mapping.value = res.data.mapping;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
});

async function fetchSchemas() {
    const list = await server.GET('/api/core/schema');
    if (list.error) throw new Error(list.error.message);

    destinations.value = list.data.items.map((item) => item.id);

    await Promise.all(destinations.value.map(async (id) => {
        const res = await server.GET('/api/core/schema/{:id}', {
            params: { path: { ':id': id } },
        });
        if (res.error) throw new Error(res.error.message);

        definitions.value[id] = res.data;
    }));
}

const definition = computed(() => definitions.value[form.value.destination]);

// The fields of one destination mean nothing to another so the mapping starts over
function setDestination(destination: Destination) {
    if (destination === form.value.destination) return;

    mapping.value = {};
    form.value.destination = destination;
}

const valid = computed(() => form.value.name.trim().length > 0 && (isDefault.value || form.value.query.trim().length > 0));

async function save() {
    loading.value = 'Saving Query';

    try {
        const body = {
            name: form.value.name,
            destination: form.value.destination,
            query: isDefault.value ? null : form.value.query,
            mapping: mapping.value,
        };

        const res = isNew.value
            ? await server.POST('/api/connection/{:connectionid}/layer/{:layerid}/incoming/mapping', {
                params: { path: pathParams.value },
                body: { ...body, schema: schema.value },
            })
            : await server.PATCH('/api/connection/{:connectionid}/layer/{:layerid}/incoming/mapping/{:mappingid}', {
                params: { path: { ...pathParams.value, ':mappingid': queryId.value } },
                body,
            });
        if (res.error) throw new Error(res.error.message);

        back();
    } finally {
        loading.value = false;
    }
}

async function remove() {
    loading.value = 'Deleting Query';

    try {
        const res = await server.DELETE('/api/connection/{:connectionid}/layer/{:layerid}/incoming/mapping/{:mappingid}', {
            params: { path: { ...pathParams.value, ':mappingid': queryId.value } },
        });
        if (res.error) throw new Error(res.error.message);

        back();
    } finally {
        loading.value = false;
    }
}

function back() {
    router.push({ name: 'layer-incoming-mapping-schema' });
}
</script>
