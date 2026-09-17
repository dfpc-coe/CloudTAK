<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Field Mapping
            </h3>
        </div>

        <TablerAlert
            v-if='!props.capabilities'
            title='Missing Capabilities'
            :err='new Error("Layer failed to return an incoming output schema on the Capabilities object")'
        />
        <TablerAlert
            v-else-if='props.capabilities.incoming?.schema?.outputError'
            title='Missing Output Schema'
            :err='new Error(props.capabilities.incoming.schema.outputError.message)'
        />
        <TablerNone
            v-else-if='!entries.length'
            label='No Schema'
            :create='false'
        />
        <template v-else>
            <TablerInlineAlert
                class='px-2 my-2'
                title='Field Mapping is read-only'
                description='The API to create and edit Maps is pending. Records posted by this Layer are currently handled by Legacy Styling.'
            />

            <div class='px-2 pb-2 d-flex flex-column gap-2'>
                <StandardItem
                    v-for='entry in entries'
                    :key='entry.id'
                    :class='{ "mapping-unmapped": !entry.mapped }'
                    :style='entry.mapped ? "" : "border-style: dashed;"'
                    @click='open(entry.id)'
                >
                    <div class='px-2 py-2 d-flex align-items-center'>
                        <IconSchema
                            :size='32'
                            stroke='1'
                        />
                        <div class='mx-3'>
                            <div class='fw-bold'>
                                {{ entry.id }}
                            </div>
                            <div
                                v-if='!entry.mapped'
                                class='text-muted small'
                            >
                                Not mapped
                            </div>
                            <div
                                v-else
                                class='text-muted small'
                            >
                                {{ entry.queryCount }} {{ entry.queryCount === 1 ? 'query' : 'queries' }}
                            </div>
                        </div>
                        <div class='ms-auto d-flex align-items-center gap-1'>
                            <span
                                v-if='!entry.mapped'
                                class='mapping-create text-white d-flex align-items-center'
                            >
                                Create Mapping
                                <IconCaretRightFilled
                                    :size='32'
                                    stroke='1'
                                />
                            </span>
                            <span
                                v-if='!entry.inSchema'
                                class='badge bg-yellow-lt'
                                title='The Task does not expose an Output schema with this name'
                            >Unknown Schema</span>
                            <span
                                v-for='destination in entry.destinations'
                                :key='destination'
                                class='badge bg-blue-lt'
                            >{{ destination }}</span>
                        </div>
                    </div>
                </StandardItem>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ETLLayer, ETLLayerTaskCapabilities } from '../../../types.ts';
import {
    TablerNone,
    TablerAlert,
    TablerInlineAlert
} from '@tak-ps/vue-tabler';
import { IconSchema, IconCaretRightFilled } from '@tabler/icons-vue';
import StandardItem from '../../CloudTAK/util/StandardItem.vue';
import { outputSchemas } from './utils/namedSchemas.ts';

type SchemaEntry = {
    id: string;
    mapped: boolean;
    inSchema: boolean;
    destinations: string[];
    queryCount: number;
};

const props = defineProps<{
    layer: ETLLayer;
    capabilities: ETLLayerTaskCapabilities;
}>();

const route = useRoute();
const router = useRouter();

const schemas = computed(() => outputSchemas(props.capabilities));
const maps = computed(() => props.layer.incoming?.maps ?? []);

/** Mapped schemas first, then the Task's unmapped schemas, each in name order */
const entries = computed<SchemaEntry[]>(() => {
    const byId = new Map<string, SchemaEntry>();

    for (const s of schemas.value) {
        byId.set(s.id, { id: s.id, mapped: false, inSchema: true, destinations: [], queryCount: 0 });
    }

    for (const map of maps.value) {
        const entry = byId.get(map.schema) ?? { id: map.schema, mapped: false, inSchema: false, destinations: [], queryCount: 0 };
        entry.mapped = true;
        if (!entry.destinations.includes(map.destination)) entry.destinations.push(map.destination);
        entry.queryCount += map.queries.length;
        byId.set(map.schema, entry);
    }

    const all = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));

    return [...all.filter((e) => e.mapped), ...all.filter((e) => !e.mapped)];
});

function open(schema: string) {
    router.push({
        name: 'layer-incoming-mapping-schema',
        params: {
            connectionid: route.params.connectionid,
            layerid: route.params.layerid,
            schema,
        },
    });
}
</script>

<style scoped>
.mapping-create {
    opacity: 0;
    transition: opacity 0.15s ease-in-out;
}

.mapping-unmapped:hover .mapping-create,
.mapping-unmapped:focus-within .mapping-create {
    opacity: 1;
}
</style>
