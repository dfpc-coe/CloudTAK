<template>
<div class='col-md-12 my-3'>
    <div class='d-flex'>
        <h3>Environment</h3>
        <div v-if='!disabled' class='ms-auto'>
            <PlusIcon @click='environment.push({key: "", value: ""})' class='cursor-pointer'/>
        </div>
    </div>

    <div class="table-responsive">
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
</div>
</template>

<script>
import {
    TablerInput
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
    },
    data: function() {
        return {
            environment: [],
            loading: {
                schema: false
            },
        };
    },
    watch: {
        environment: {
            deep: true,
            handler: function() {
                const env = {};
                for (const kv of this.environment) {
                    env[kv.key] = kv.value;
                }
                this.layerdata.environment = env;
            }
        },
    },
    mounted: function() {
        this.environment = Object.keys(this.modelValue).map((key) => {
            return { key: key, value: this.layerdata.environment[key] };
        });
    },
    methods: {
    },
    components: {
        PlusIcon,
        TablerInput
    }
}
</script>
