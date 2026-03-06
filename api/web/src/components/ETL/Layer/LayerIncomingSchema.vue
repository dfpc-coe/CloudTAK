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
            v-else-if='!props.capabilities.incoming.schema.output || props.capabilities.incoming.schema.outputError'
            title='Missing Output Schema'
            :err='new Error(props.capabilities.incoming.schema.outputError.message) || new Error("Layer failed to return an output schema on the Capabilities object")'
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
                        :properties='props.capabilities.incoming.schema.output.properties'
                        :required='props.capabilities.incoming.schema.output.required || []'
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

<script setup>
import { ref, computed } from 'vue';
import {
    TablerNone,
    TablerAlert
} from '@tak-ps/vue-tabler';
import SchemaRows from './utils/SchemaRows.vue';

const props = defineProps({
    layer: {
        type: Object,
        required: true
    },
    capabilities: {
        type: Object,
        required: true
    }
});

const expanded = ref(new Set());

const hasProperties = computed(() => {
    return props.capabilities
        && props.capabilities.incoming.schema.output
        && props.capabilities.incoming.schema.output.properties
        && Object.keys(props.capabilities.incoming.schema.output.properties).length > 0;
});

function toggleExpand(path) {
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
