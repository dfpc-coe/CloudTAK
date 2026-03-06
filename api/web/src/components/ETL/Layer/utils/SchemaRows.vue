<template>
    <template
        v-for='field in fields'
        :key='field.path'
    >
        <tr
            :class='{ "cursor-pointer": field.expandable }'
            @click='field.expandable && toggleExpand(field.path)'
        >
            <td>
                <div
                    class='d-flex align-items-center'
                    :style='{ paddingLeft: (props.depth * 24) + "px" }'
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
                        v-if='field.nullable'
                        style='height: 20px;'
                        class='badge mx-1 mb-1 bg-yellow text-dark'
                    >Nullable</span>
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

        <SchemaRows
            v-if='field.expandable && expanded.has(field.path)'
            :properties='field.childProperties'
            :required='field.childRequired'
            :depth='props.depth + 1'
            :parent-path='field.path'
            :expanded='expanded'
            @toggle='emit("toggle", $event)'
        />
    </template>
</template>

<script setup>
import { computed } from 'vue';
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
    properties: {
        type: Object,
        required: true
    },
    required: {
        type: Array,
        default: () => []
    },
    depth: {
        type: Number,
        default: 0
    },
    parentPath: {
        type: String,
        default: ''
    },
    expanded: {
        type: Set,
        required: true
    }
});

const emit = defineEmits(['toggle']);

function toggleExpand(path) {
    emit('toggle', path);
}

function resolveAnyOf(prop) {
    if (!prop.anyOf || !Array.isArray(prop.anyOf)) return prop;

    const nullable = prop.anyOf.some(s => s.type === 'null');
    const nonNull = prop.anyOf.filter(s => s.type !== 'null');
    const resolved = nonNull.length === 1 ? nonNull[0] : nonNull[0] || {};
    const type = nonNull.map(s => s.type).filter(Boolean).join(' | ');

    return {
        ...resolved,
        type: type || resolved.type,
        nullable,
    };
}

const fields = computed(() => {
    if (!props.properties) return [];

    return Object.keys(props.properties).map(name => {
        const rawProp = props.properties[name];
        const prop = resolveAnyOf(rawProp);
        const path = props.parentPath ? `${props.parentPath}.${name}` : name;
        const isRequired = Array.isArray(props.required) && props.required.includes(name);

        const hasObjectChildren = prop.type === 'object' && prop.properties;
        const hasArrayObjectChildren = prop.type === 'array'
            && prop.items
            && prop.items.type === 'object'
            && prop.items.properties;
        const expandable = hasObjectChildren || hasArrayObjectChildren;

        let childProperties = null;
        let childRequired = [];
        if (hasObjectChildren) {
            childProperties = prop.properties;
            childRequired = prop.required || [];
        } else if (hasArrayObjectChildren) {
            childProperties = prop.items.properties;
            childRequired = prop.items.required || [];
        }

        return {
            name,
            path,
            required: isRequired,
            nullable: prop.nullable || false,
            expandable,
            childProperties,
            childRequired,
            type: prop.type || '',
            format: prop.format || '',
        };
    });
});
</script>
