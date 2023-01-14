<template>
<div class="col-md-12">
    <label>Connection</label>

    <template v-if='loading'>
        <TablerLoading/>
    </template>
    <template v-else>
        <div class='d-flex'>
            <template v-if='selected.id'>
                <ConnectionStatus :connection='selected'/>
                <span class='mt-2' v-text='selected.name'/>
            </template>
            <template v-else>
                Select A Connection Using the Gear Icon on the right
            </template>

            <div v-if='!disabled' class='ms-auto'>
                <div class="dropdown">
                    <div class="dropdown-toggle" type="button" id="dropdownMenuButton1" data-bs-toggle="dropdown" aria-expanded="false">
                        <SettingsIcon
                            class='cursor-pointer dropdown-toggle'
                        />
                    </div>
                    <ul class="dropdown-menu" aria-labelledby="dropdownMenuButton1">
                        <div class='m-1'>
                            <div class='table-resposive'>
                                <table class='table table-hover'>
                                    <thead>
                                        <tr>
                                            <th>(Status) Name</th>
                                        </tr>
                                    </thead>
                                    <tbody class='table-tbody'>
                                        <tr @click='selected = connection' :key='connection.id' v-for='connection of connections.connections' class='cursor-pointer'>
                                            <td>
                                                <div class='d-flex'>
                                                    <ConnectionStatus :connection='connection'/>
                                                    <span class='mt-2' v-text='connection.name'/>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </ul>
                </div>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import {
    SettingsIcon
} from 'vue-tabler-icons';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import ConnectionStatus from '../Connection/Status.vue';

export default {
    name: 'ConnectionSelect',
    props: {
        modelValue: Number,
        disabled: {
            type: Boolean,
            default: false
        }
    },
    data: function() {
        return {
            loading: true,
            selected: {
                id: '',
                status: 'dead',
                name: ''
            },
            connections: {
                total: 0,
                connections: []
            }
        }
    },
    watch: {
        selected: function() {
            this.$emit('update:modelValue', this.selected.id);
        },
        modelValue: function() {
            if (this.modelValue) this.fetch();
        }
    },
    mounted: async function() {
        if (this.modelValue) await this.fetch();
        await this.listConnections();
        this.loading = false;
    },
    methods: {
        fetch: async function() {
            this.selected = await window.std(`/api/connection/${this.modelValue}`);
        },
        listConnections: async function() {
            this.connections = await window.std('/api/connection');
        },
    },
    components: {
        SettingsIcon,
        ConnectionStatus,
        TablerLoading
    }
};
</script>
