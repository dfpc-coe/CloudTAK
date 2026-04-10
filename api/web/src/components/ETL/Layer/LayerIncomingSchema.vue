<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Schema
            </h3>
        </div>

        <TablerAlert
            v-if='!props.capabilities'
            title='Missing Capabilities'
            :err='new Error("Layer failed to return an incoming input schema on the Capabilities object")'
        />
        <TablerAlert
            v-else-if='!props.capabilities.incoming?.schema?.output || props.capabilities.incoming?.schema?.outputError'
            title='Missing Output Schema'
            :err='new Error(props.capabilities.incoming?.schema?.outputError?.message || "Layer failed to return an output schema on the Capabilities object")'
        />
        <TablerNone
            v-else-if='!hasProperties'
            label='No Schema'
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
                        :properties='((props.capabilities.incoming?.schema?.output as Record<string, unknown>)?.properties ?? {}) as Record<string, Record<string, unknown>>'
                        :required='(props.capabilities.incoming?.schema?.output as Record<string, unknown>)?.required as string[] ?? []'
                        :depth='0'
                        parent-path=''
                        :expanded='expanded'
                        @toggle='toggleExpand'
                    />
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import type { ETLLayer, ETLLayerTaskCapabilities } from '../../../types.ts';
import {
    TablerNone,
    TablerAlert
} from '@tak-ps/vue-tabler';
import SchemaRows from './utils/SchemaRows.vue';

const props = defineProps<{
    layer: ETLLayer;
    capabilities: ETLLayerTaskCapabilities;
}>();

const expanded = ref(new Set<string>());

const hasProperties = computed(() => {
    const incoming = props.capabilities?.incoming;
    if (!incoming) return false;
    const output = incoming.schema.output as Record<string, unknown> | undefined;
    return output?.properties
        && Object.keys(output.properties as Record<string, unknown>).length > 0;
});

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
