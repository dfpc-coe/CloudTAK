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
            <div class='ms-auto btn-list'>
                <button
                    class='btn btn-primary btn-icon px-2'
                    title='Save Query'
                    disabled
                >
                    <IconDeviceFloppy
                        :size='32'
                        stroke='1'
                    />
                </button>
            </div>
        </div>

        <TablerNone
            v-if='!isNew && !existing'
            label='Query'
            :create='false'
        />
        <template v-else>
            <TablerInlineAlert
                class='px-2 my-2'
                title='Queries are read-only'
                description='The API to create and edit Queries is pending - changes made here are not saved.'
            />

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
                    <TablerInput
                        v-model='query.query'
                        label='Query'
                        description='JSONata query evaluated against each record - records it matches are mapped'
                        placeholder='status = "offline"'
                    />
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-model='mapping'
                        label='Mapping'
                        description='Mapping object applied to records matched by the query'
                        :error='mappingError'
                        :rows='8'
                    />
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ETLLayer, ETLLayerTaskCapabilities } from '../../../types.ts';
import {
    TablerNone,
    TablerEnum,
    TablerInput,
    TablerToggle,
    TablerIconButton,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-vue';

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

const route = useRoute();
const router = useRouter();

const destinations: Destination[] = ['CoreFeature', 'CoreEvent', 'CoreDevice'];

const schema = computed(() => String(route.params.schema));
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

const mapping = ref(JSON.stringify(existing.value?.map ?? {}, null, 4));

const mappingError = computed(() => {
    try {
        const parsed = JSON.parse(mapping.value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'Mapping must be a JSON object';
        return '';
    } catch (err) {
        return err instanceof Error ? err.message : String(err);
    }
});

watch(isDefault, (value) => {
    if (value) query.value.query = '';
});

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
