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
                    <TablerBadge
                        v-if='field.required'
                        class='mx-1 mb-1'
                        style='height: 20px;'
                        background-color='rgba(239, 68, 68, 0.2)'
                        border-color='rgba(239, 68, 68, 0.5)'
                        text-color='#dc2626'
                    >
                        Required
                    </TablerBadge>
                    <TablerBadge
                        v-if='field.nullable'
                        class='mx-1 mb-1'
                        style='height: 20px;'
                        background-color='rgba(245, 158, 11, 0.2)'
                        border-color='rgba(245, 158, 11, 0.5)'
                        text-color='#d97706'
                    >
                        Nullable
                    </TablerBadge>
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
            :properties='field.childProperties ?? {}'
            :required='field.childRequired'
            :depth='props.depth + 1'
            :parent-path='field.path'
            :expanded='expanded'
            @toggle='emit("toggle", $event)'
        />
    </template>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
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

interface SchemaProperty {
    type?: string;
    format?: string;
    nullable?: boolean;
    properties?: Record<string, SchemaProperty>;
    items?: SchemaProperty;
    required?: string[];
    anyOf?: SchemaProperty[];
    [key: string]: unknown;
}

const props = withDefaults(defineProps<{
    properties: Record<string, SchemaProperty>;
    required?: string[];
    depth?: number;
    parentPath?: string;
    expanded: Set<string>;
}>(), {
    required: () => [],
    depth: 0,
    parentPath: '',
});

const emit = defineEmits<{
    (e: 'toggle', path: string): void;
}>();

function toggleExpand(path: string) {
    emit('toggle', path);
}

function resolveAnyOf(prop: SchemaProperty): SchemaProperty {
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

        let childProperties: Record<string, SchemaProperty> | null = null;
        let childRequired: string[] = [];
        if (hasObjectChildren) {
            childProperties = prop.properties!;
            childRequired = prop.required || [];
        } else if (hasArrayObjectChildren) {
            childProperties = prop.items!.properties!;
            childRequired = prop.items!.required || [];
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
