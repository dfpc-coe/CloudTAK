<template>
<div class="col-md-12">
    <label class="form-label">Connection</label>
    <div class='d-flex'>
        <template v-if='selected.id'>
            <ConnectionStatus :connection='selected'/>
            <span class='mt-2' v-text='selected.name'/>
        </template>
        <template v-else>
            Select A Connection Using the Gear Icon on the right
        </template>

        <div class='ms-auto'>
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
</div>
</template>

<script>
import {
    SettingsIcon
} from 'vue-tabler-icons';
import ConnectionStatus from '../Connection/Status.vue';

export default {
    name: 'ConnectionSelect',
    props: {
        connection: Number,
    },
    data: function() {
        return {
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
    mounted: function() {
        this.listConnections();
        if (this.connection) this.fetch();
    },
    methods: {
        fetch: async function() {
            try {
                this.selected = await window.std(`/api/connection/${this.connection}`);
            } catch (err) {
                this.$emit('err', err);
            }
        },
        listConnections: async function() {
            try {
                this.connections = await window.std('/api/connection');
            } catch (err) {
                this.err = err;
            }
        },
    },
    components: {
        SettingsIcon,
        ConnectionStatus
    }
};
</script>
