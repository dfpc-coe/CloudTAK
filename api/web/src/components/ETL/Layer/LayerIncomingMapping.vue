<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Field Mapping
            </h3>
        </div>

        <TablerLoading
            v-if='loading'
            desc='Loading Mappings'
        />
        <TablerAlert
            v-else-if='error'
            title='Mappings Error'
            :err='error'
        />
        <TablerAlert
            v-else-if='!props.capabilities'
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
        <div
            v-else
            class='px-2 pb-2 d-flex flex-column gap-2'
        >
            <StandardItem
                v-for='entry in entries'
                :key='entry.id'
                :class='{ "mapping-unmapped": !entry.mapped }'
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
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { ETLLayerTaskCapabilities } from '../../../types.ts';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import { IconSchema, IconCaretRightFilled } from '@tabler/icons-vue';
import StandardItem from '../../CloudTAK/util/StandardItem.vue';
import { outputSchemas } from './utils/namedSchemas.ts';
import { useLayerMappings } from './utils/layerMappings.ts';

type SchemaEntry = {
    id: string;
    mapped: boolean;
    inSchema: boolean;
    destinations: string[];
    queryCount: number;
};

const props = defineProps<{
    capabilities: ETLLayerTaskCapabilities;
}>();

const router = useRouter();
const { mappings, loading, error } = useLayerMappings();

function blank(id: string, inSchema: boolean): SchemaEntry {
    return { id, mapped: false, inSchema, destinations: [], queryCount: 0 };
}

/** Mapped schemas first, then the Task's unmapped schemas, each in name order */
const entries = computed<SchemaEntry[]>(() => {
    const byId = new Map<string, SchemaEntry>();

    for (const s of outputSchemas(props.capabilities)) {
        byId.set(s.id, blank(s.id, true));
    }

    for (const mapping of mappings.value) {
        const entry = byId.get(mapping.schema) ?? blank(mapping.schema, false);
        entry.mapped = true;
        if (!entry.destinations.includes(mapping.destination)) entry.destinations.push(mapping.destination);
        entry.queryCount++;
        byId.set(mapping.schema, entry);
    }

    return Array.from(byId.values())
        .sort((a, b) => Number(b.mapped) - Number(a.mapped) || a.id.localeCompare(b.id));
});

function open(schema: string) {
    router.push({
        name: 'layer-incoming-mapping-schema',
        params: { schema },
    });
}
</script>

<style scoped>
.standard-item.mapping-unmapped {
    border-style: dashed;
}

.mapping-create {
    opacity: 0;
    transition: opacity 0.15s ease-in-out;
}

.mapping-unmapped:hover .mapping-create,
.mapping-unmapped:focus-within .mapping-create {
    opacity: 1;
}
</style>
