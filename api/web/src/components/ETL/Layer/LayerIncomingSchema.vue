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
        <TablerNone
            v-else-if='!schema.length'
            label='Schema'
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
                        v-for='field in schema'
                        :key='field.name'
                    >
                        <td>
                            <div class='d-flex align-items-center'>
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
                            <span
                                v-if='field.required'
                                style='height: 20px;'
                                class='badge mx-1 mb-1 bg-red text-white'
                            >Required</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted} from 'vue';
import {
    TablerNone,
    TablerAlert
} from '@tak-ps/vue-tabler';
import {
    IconAlphabetLatin,
    IconSort09,
    IconDecimal,
    IconBinary,
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

const schema = ref([]);

watch(props.capabilities, () => {
    processCapabilities();
})

onMounted(() => {
    processCapabilities();
});

function processCapabilities() {
    schema.value.splice(0, schema.value.length);
    if (!props.capabilities) return;

    for (const name in props.capabilities.incoming.schema.output.properties) {
        schema.value.push({
            name,
            required: props.capabilities.incoming.schema.output.required.includes(name),
            ...props.capabilities.incoming.schema.output.properties[name]
        });
    }

}
</script>
