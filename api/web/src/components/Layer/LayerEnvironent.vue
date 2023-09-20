<template>
<div class='col-md-12 my-3'>
    <div class='d-flex'>
        <h3>Environment</h3>
        <div class='ms-auto'>
            <div v-if='mode === "list"' class='btn-list'>
                <PlusIcon v-if='!disabled' @click='environment.push({key: "", value: ""})' class='cursor-pointer'/>
            </div>
            <div v-else-if='mode === "schema"' class='btn-list'>
                <RefreshIcon @click='fetchSchema' class='cursor-pointer'/>
            </div>
        </div>
    </div>

    <TablerLoading v-if='loading.schema' desc='Loading Environment'/>
    <div v-else-if='mode === "list"' class="table-responsive">
        <table class="table table-vcenter card-table">
            <thead class='sticky-top'>
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
            <Schema :schema='schema' :disabled='disabled' v-model='environment'/>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerInput,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import Schema from './Schema.vue';
import {
    PlusIcon,
    RefreshIcon
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
            alert: false,
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
            this.alert = false;

            try {
                this.loading.schema = true;
                this.schema = (await window.std(`/api/layer/${this.$route.params.layerid}/task/schema`)).schema;
            } catch (err) {
                this.alert = true;
            }

            this.loading.schema = false;
        }
    },
    components: {
        Schema,
        PlusIcon,
        RefreshIcon,
        TablerInput,
        TablerLoading,
    }
}
</script>
