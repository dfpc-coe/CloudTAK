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
            v-else-if='!visibleFields.length'
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
                    <tr
                        v-for='field in visibleFields'
                        :key='field.path'
                        :class='{ "cursor-pointer": field.expandable }'
                        @click='field.expandable && toggleExpand(field.path)'
                    >
                        <td>
                            <div
                                class='d-flex align-items-center'
                                :style='{ paddingLeft: (field.depth * 24) + "px" }'
                            >
                                <span class='mx-3'>
                                    <template v-if='field.type === "string"'>
                                        <IconAlphabetLatin
                                            :size='32'
                                            stroke='1'
                                        />
                                    </template>
                                    <template v-else-if='field.type === "number"'>
                                        <IconDecimal
                                            :size='32'
                                            stroke='1'
                                        />
                                    </template>
                                    <template v-else-if='field.type === "integer"'>
                                        <IconSort09
                                            :size='32'
                                            stroke='1'
                                        />
                                    </template>
                                    <template v-else-if='field.type === "object"'>
                                        <IconBraces
                                            :size='32'
                                            stroke='1'
                                        />
                                    </template>
                                    <template v-else-if='field.type === "array"'>
                                        <IconBrackets
                                            :size='32'
                                            stroke='1'
                                        />
                                    </template>
                                    <template v-else-if='field.type === "boolean"'>
                                        <IconToggleLeft
                                            :size='32'
                                            stroke='1'
                                        />
                                    </template>
                                    <template v-else>
                                        <IconBinary
                                            :size='32'
                                            stroke='1'
                                        />
                                    </template>
                                </span>
                                <span v-text='field.name' />
                            </div>
                        </td>
                        <td v-text='field.type' />
                        <td v-text='field.format' />
                        <td>
                            <div class='d-flex align-items-center'>
                                <span
                                    v-if='field.required'
                                    style='height: 20px;'
                                    class='badge mx-1 mb-1 bg-red text-white'
                                >Required</span>
                                <span
                                    v-if='field.expandable'
                                    class='d-flex align-items-center ms-auto'
                                >
                                    <IconChevronDown
                                        v-if='expanded.has(field.path)'
                                        :size='16'
                                        stroke='1'
                                    />
                                    <IconChevronRight
                                        v-else
                                        :size='16'
                                        stroke='1'
                                    />
                                </span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import {
    TablerNone,
    TablerAlert
} from '@tak-ps/vue-tabler';
import {
    IconAlphabetLatin,
    IconSort09,
    IconDecimal,
    IconBinary,
    IconBraces,
    IconBrackets,
    IconToggleLeft,
    IconChevronDown,
    IconChevronRight,
} from '@tabler/icons-vue'

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

const schemaOutput = ref(null);
const expanded = ref(new Set());

function toggleExpand(path) {
    const next = new Set(expanded.value);
    if (next.has(path)) {
        // Collapse this and all children
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

function flattenProperties(properties, required, depth, parentPath) {
    const fields = [];
    if (!properties) return fields;

    for (const name of Object.keys(properties)) {
        const prop = properties[name];
        const path = parentPath ? `${parentPath}.${name}` : name;
        const isRequired = Array.isArray(required) && required.includes(name);

        const hasObjectChildren = prop.type === 'object' && prop.properties;
        const hasArrayObjectChildren = prop.type === 'array'
            && prop.items
            && prop.items.type === 'object'
            && prop.items.properties;
        const expandable = hasObjectChildren || hasArrayObjectChildren;

        fields.push({
            name,
            path,
            depth,
            required: isRequired,
            expandable,
            type: prop.type || '',
            format: prop.format || '',
        });

        if (expandable && expanded.value.has(path)) {
            if (hasObjectChildren) {
                fields.push(...flattenProperties(prop.properties, prop.required, depth + 1, path));
            } else if (hasArrayObjectChildren) {
                fields.push(...flattenProperties(prop.items.properties, prop.items.required, depth + 1, path));
            }
        }
    }
    return fields;
}

const visibleFields = computed(() => {
    if (!schemaOutput.value || !schemaOutput.value.properties) return [];
    return flattenProperties(
        schemaOutput.value.properties,
        schemaOutput.value.required || [],
        0,
        ''
    );
});

watch(props.capabilities, () => {
    processCapabilities();
})

onMounted(() => {
    processCapabilities();
});

function processCapabilities() {
    if (!props.capabilities || !props.capabilities.incoming.schema.output) {
        schemaOutput.value = null;
        return;
    }
    schemaOutput.value = props.capabilities.incoming.schema.output;
}
</script>
