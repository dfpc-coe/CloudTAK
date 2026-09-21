<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Schema
            </h3>

            <TablerEnum
                v-if='schemas.length'
                v-model='selected'
                class='ms-auto'
                style='width: 240px;'
                :options='schemas.map((s) => s.id)'
            />
        </div>

        <TablerAlert
            v-if='!props.capabilities'
            title='Missing Capabilities'
            :err='new Error("Layer failed to return an incoming input schema on the Capabilities object")'
        />
        <TablerAlert
            v-else-if='props.capabilities.incoming?.schema?.outputError'
            title='Missing Output Schema'
            :err='new Error(props.capabilities.incoming.schema.outputError.message)'
        />
        <TablerNone
            v-else-if='!schemas.length'
            label='No Schema'
            :create='false'
        />
        <template v-else>
            <TablerNone
                v-if='!hasProperties'
                label='No Schema Properties'
                :create='false'
            />
            <div
                v-else
                class='table-responsive'
            >
                <table class='table table-hover card-table table-vcenter'>
                    <thead>
                        <tr>
                            <th>Property Name</th>
                            <th>Type</th>
                            <th>Format</th>
                            <th>Attributes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <SchemaRows
                            :properties='(current?.properties ?? {}) as Record<string, Record<string, unknown>>'
                            :required='(current?.required as string[]) ?? []'
                            :depth='0'
                            parent-path=''
                            :expanded='expanded'
                            @toggle='toggleExpand'
                        />
                    </tbody>
                </table>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import type { ETLLayer, ETLLayerTaskCapabilities } from '../../../types.ts';
import {
    TablerNone,
    TablerAlert,
    TablerEnum
} from '@tak-ps/vue-tabler';
import SchemaRows from './utils/SchemaRows.vue';
import { outputSchemas, DEFAULT_SCHEMA_ID } from './utils/namedSchemas.ts';

const props = defineProps<{
    layer: ETLLayer;
    capabilities: ETLLayerTaskCapabilities;
}>();

const schemas = computed(() => outputSchemas(props.capabilities));

const selected = ref(initialSchema());
const expanded = ref(new Set<string>());

const current = computed(() => {
    return schemas.value.find((s) => s.id === selected.value)?.schema;
});

const hasProperties = computed(() => {
    const properties = current.value?.properties;
    return !!properties && Object.keys(properties as Record<string, unknown>).length > 0;
});

watch(schemas, () => {
    if (!schemas.value.some((s) => s.id === selected.value)) {
        selected.value = initialSchema();
    }
});

watch(selected, () => {
    expanded.value = new Set<string>();
});

function initialSchema(): string {
    const ids = schemas.value.map((s) => s.id);
    return ids.includes(DEFAULT_SCHEMA_ID) ? DEFAULT_SCHEMA_ID : (ids[0] ?? '');
}

function toggleExpand(path: string) {
    const next = new Set(expanded.value);
    if (next.has(path)) {
        for (const p of next) {
            if (p === path || p.startsWith(path + '.')) {
                next.delete(p);
            }
        }
    } else {
        next.add(path);
    }
    expanded.value = next;
}
</script>
