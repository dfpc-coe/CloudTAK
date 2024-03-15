<template>
<div class='w-100'>
    <template v-if='loading'>
        <TablerLoading :inline='true'/>
    </template>
    <template v-else>
        <div class='d-flex'>
            <template v-if='selected.id'>
                <div @click='$router.push(`/connection/${selected.id}`)' class='d-flex cursor-pointer align-items-center'>
                    <ConnectionStatus :connection='selected'/>
                    <span class='mx-2' v-text='selected.name'/>
                </div>
            </template>
            <template v-else>
                <span class='mt-2'>No Connection Selected!</span>
            </template>

            <div v-if='!disabled' class='ms-auto'>
                <div class="dropdown">
                    <div class="dropdown-toggle" type="button" id="dropdownMenuButton1" data-bs-toggle="dropdown" aria-expanded="false">
                        <IconSettings
                            size='32'
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
                                        <tr @click='selected = connection' :key='connection.id' v-for='connection of connections.items' class='cursor-pointer'>
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
    IconSettings
} from '@tabler/icons-vue';
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
                items: []
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
        IconSettings,
        ConnectionStatus,
        TablerLoading
    }
};
</script>
