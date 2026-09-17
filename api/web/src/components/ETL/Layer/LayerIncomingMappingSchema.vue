<template>
    <div>
        <div class='card-header d-flex align-items-center'>
            <TablerIconButton
                title='Back to Field Mapping'
                @click='back'
            >
                <IconArrowLeft
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <h3 class='card-title mx-2'>
                {{ schema }} Queries
            </h3>
            <span
                v-if='!inSchema'
                class='badge bg-yellow-lt'
                title='The Task does not expose an Output schema with this name'
            >Unknown Schema</span>
            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='New Query'
                    @click='openQuery("new")'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>

        <TablerNone
            v-if='!queries.length'
            label='No Named Queries'
            :create='false'
        />
        <div
            v-else
            class='px-2 py-2 d-flex flex-column gap-2'
        >
            <StandardItem
                v-for='query in queries'
                :key='query.id'
                @click='openQuery(query.id)'
            >
                <div class='px-2 py-2 d-flex align-items-center'>
                    <IconFilter
                        :size='32'
                        stroke='1'
                    />
                    <div class='mx-3 flex-grow-1 overflow-hidden'>
                        <div class='fw-bold'>
                            {{ query.name || 'Unnamed Query' }}
                        </div>
                        <div
                            class='text-muted small text-truncate'
                            :class='{ "font-monospace": query.query !== null }'
                            :title='query.query ?? undefined'
                        >
                            {{ query.query ?? 'Matches every record' }}
                        </div>
                    </div>
                    <span class='badge bg-blue-lt'>{{ query.destination }}</span>
                </div>
            </StandardItem>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ETLLayer, ETLLayerTaskCapabilities } from '../../../types.ts';
import {
    TablerNone,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import { IconArrowLeft, IconFilter, IconPlus } from '@tabler/icons-vue';
import StandardItem from '../../CloudTAK/util/StandardItem.vue';
import { outputSchemas } from './utils/namedSchemas.ts';

const props = defineProps<{
    layer: ETLLayer;
    capabilities: ETLLayerTaskCapabilities;
}>();

const route = useRoute();
const router = useRouter();

const schema = computed(() => String(route.params.schema));

const inSchema = computed(() => outputSchemas(props.capabilities).some((s) => s.id === schema.value));

/** Every query of every Map for this schema, tagged with the Map's destination */
const queries = computed(() => {
    return (props.layer.incoming?.maps ?? [])
        .filter((map) => map.schema === schema.value)
        .flatMap((map) => map.queries.map((query) => ({ ...query, destination: map.destination })));
});

function openQuery(query: number | 'new') {
    router.push({
        name: query === 'new' ? 'layer-incoming-mapping-query-new' : 'layer-incoming-mapping-query',
        params: {
            connectionid: route.params.connectionid,
            layerid: route.params.layerid,
            schema: schema.value,
            ...(query === 'new' ? {} : { query }),
        },
    });
}

function back() {
    router.push({
        name: 'layer-incoming-mapping',
        params: {
            connectionid: route.params.connectionid,
            layerid: route.params.layerid,
        },
    });
}
</script>
