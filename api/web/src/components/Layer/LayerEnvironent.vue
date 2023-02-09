<template>
<div class='col-md-12 my-3'>
    <div class='d-flex'>
        <h3>Environment</h3>
        <div v-if='!disabled' class='ms-auto'>
            <PlusIcon @click='environment.push({key: "", value: ""})' class='cursor-pointer'/>
        </div>
    </div>

    <TablerLoading v-if='loading.schema' desc='Loading Environment'/>
    <div v-else-if='mode === "list"' class="table-responsive">
        <table class="table table-vcenter card-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                <template v-if='environment.length'>
                    <tr :key='kv_i' v-for='(kv, kv_i) in environment'>
                        <template v-if='disabled'>
                            <td v-text='kv.key'></td>
                            <td v-text='kv.value'></td>
                        </template>
                        <template v-else>
                            <td>
                                <TablerInput placeholder='KEY' v-model='kv.key'/>
                            </td>
                            <td>
                                <TablerInput placeholder='VALUE' v-model='kv.value'/>
                            </td>
                        </template>
                    </tr>
                </template>
            </tbody>
        </table>
        <template v-if='!environment.length'>
            <div class="d-flex justify-content-center my-4">
                No Environment Variables Set
            </div>
        </template>
    </div>
    <div v-else-if='mode === "schema"' class="col">
        <template v-if='schema.type !== "object"'>
            <div class="d-flex justify-content-center my-4">
                Only Object Schemas are Supported.
            </div>
        </template>
        <template v-else>
            <div :key='key' v-for='key in Object.keys(schema.properties)' class='py-2 floating-input'>
                <template v-if='schema.properties[key].enum'>
                    <div class='row border round px-2 py-2'>
                        SELECT
                    </div>
                </template>
                <template v-else-if='schema.properties[key].type === "string"'>
                    <div class='row border round px-2 py-2'>
                        <TablerInput :label='key' :disabled='disabled' v-model='environment[key]'/>
                    </div>
                </template>
                <template v-else-if='schema.properties[key].type === "boolean"'>
                    <div class='row border round px-2 py-2'>
                        <div style='padding-left: 10px; padding-right: 10px;'>
                            <label class='form-label' v-text='key'/>
                            <div class='d-flex border rounded align-items-center'>
                                <label class="ms-auto form-check form-switch pt-2">
                                    <input v-model='environment[key]' :disabled='disabled' class="form-check-input" type="checkbox">
                                </label>
                            </div>
                        </div>
                    </div>
                </template>
                <template v-else-if='schema.properties[key].type === "array" && schema.properties[key].items.type === "string"'>
                    <div class='row border round px-2 py-2'>
                        <div class='d-flex'>
                            <label class='form-label' v-text='key'/>
                            <div class='ms-auto'>
                                <PlusIcon @click='environment[key].push("")' class='cursor-pointer'/>
                            </div>
                        </div>

                        <div :key='i' v-for='(arr, i) of environment[key]' class='my-1'>
                            <TablerInput v-model='environment[key][i]'/>
                        </div>
                    </div>
                </template>
                <template v-else>
                    <div class='row'>
                        <TablerInput :label='key' :rows='3' :disabled='disabled' v-model='environment[key]'/>
                    </div>
                </template>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    PlusIcon,
} from 'vue-tabler-icons'

export default {
    name: 'LayerEnvironment',
    props: {
        modelValue: {
            type: Object,
            required: true
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    data: function() {
        return {
            environment: [],
            mode: null,
            schema: null,
            loading: {
                schema: false
            },
        };
    },
    watch: {
        environment: {
            deep: true,
            handler: function() {
                if (Array.isArray(this.environment)) {
                    const env = {};
                    for (const kv of this.environment) {
                        env[kv.key] = kv.value;
                    }
                    this.$emit('update:modelValue', env);
                } else {
                    this.$emit('update:modelValue', this.environment);
                }
            }
        },
    },
    mounted: async function() {
        await this.fetchSchema()

        if (this.schema !== null) {
            this.environment = JSON.parse(JSON.stringify(this.modelValue));

            if (this.schema.type === 'object' && this.schema.properties) {
                for (const key in this.schema.properties) {
                    if (!this.environment[key] && this.schema.properties[key].type === 'array') {
                        this.environment[key] = [];
                    }
                }
            }

            this.$nextTick(() => {
                this.mode = 'schema';
            });
        } else {
            this.environment = Object.keys(this.modelValue).map((key) => {
                return { key: key, value: this.modelValue[key] };
            });
            this.mode = 'list';
        }
    },
    methods: {
        fetchSchema: async function() {
            this.loading.schema = true;
            this.schema = (await window.std(`/api/layer/${this.$route.params.layerid}/task/schema`)).schema;
            this.loading.schema = false;
        }
    },
    components: {
        PlusIcon,
        TablerInput,
        TablerLoading,
    }
}
</script>
