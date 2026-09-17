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

        <TablerLoading
            v-if='loading'
            desc='Loading Queries'
        />
        <TablerAlert
            v-else-if='error'
            title='Queries Error'
            :err='error'
        />
        <TablerNone
            v-else-if='!queries.length'
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
                            {{ query.query ?? 'Default - records matching no other query' }}
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
import type { ETLLayerTaskCapabilities } from '../../../types.ts';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import { IconArrowLeft, IconFilter, IconPlus } from '@tabler/icons-vue';
import StandardItem from '../../CloudTAK/util/StandardItem.vue';
import { outputSchemas } from './utils/namedSchemas.ts';
import { useLayerMappings } from './utils/layerMappings.ts';

const props = defineProps<{
    capabilities: ETLLayerTaskCapabilities;
}>();

const route = useRoute();
const router = useRouter();

const schema = computed(() => String(route.params.schema));

const { mappings: queries, loading, error } = useLayerMappings(schema.value);

const inSchema = computed(() => outputSchemas(props.capabilities).some((s) => s.id === schema.value));

function openQuery(query: number | 'new') {
    router.push({
        name: 'layer-incoming-mapping-query',
        params: { query },
    });
}

function back() {
    router.push({ name: 'layer-incoming-mapping' });
}
</script>
