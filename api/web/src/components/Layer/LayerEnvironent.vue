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
                    <div class='row'>
                        SELECT
                    </div>
                </template>
                <template v-else-if='schema.properties[key].type === "string"'>
                    <div class='row'>
                        <TablerInput :label='key' :disabled='disabled' v-model='environment[key]'/>
                    </div>
                </template>
                <template v-else-if='schema.properties[key].type === "boolean"'>
                    <div class='row' style='padding-left: 10px; padding-right: 10px;'>
                        <div class='d-flex border rounded align-items-center'>
                            <span class='px-2' v-text='key'></span>
                            <label class="ms-auto form-check form-switch pt-2">
                                <input v-model='environment[key]' :disabled='disabled' class="form-check-input" type="checkbox">
                            </label>
                        </div>
                    </div>
                </template>
                <template v-else-if='schema.properties[key].type === "array"'>
                    <div class='row'>

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
