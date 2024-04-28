<template>
<div>
    <span
        v-if='connection.agency'
        @click='info = true'
        class='badge border bg-blue text-white cursor-pointer'
        style='height: 20px' v-text='`Agency`'
    />
    <span
        v-else
        class='badge border bg-red text-white'
        style='height: 20px' v-text='`Server`'
    />

    <TablerModal v-if='info'>
        <div class="modal-status bg-yellow"></div>
        <button type="button" class="btn-close" @click='info = false' aria-label="Close"></button>

        <TablerLoading v-if='loading' desc='Loading Agency...'/>
        <template v-else>
            <div class='modal-header'>
                <div class='modal-title' v-text='agency.name'></div>
            </div>

            <div class='modal-body'>
                <div class='datagrid'>
                    <div class='datagrid-item'>
                        <div class='datagrid-title'>
                            Description
                        </div>
                        <div
                            class='datagrid-content'
                            v-text='agency.description || "No Description"'
                        />
                    </div>
                </div>
            </div>
        </template>
        <div class='modal-footer'>
            <button @click='info = false' class='btn btn-primary'>Close</button>
        </div>
    </TablerModal>
</div>
</template>

<script>
import {
    TablerModal,
    TablerLoading
} from '@tak-ps/vue-tabler';
import { std } from '/src/std.ts';

export default {
    name: 'AgencyBadge',
    props: {
        connection: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            info: false,
            loading: true,
            agency: {}
        }
    },
    watch: {
        info: async function() {
            await this.fetch()
        },
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.agency = await std(`/api/agency/${this.connection.agency}`);
            this.loading = false;
        }
    },
    components: {
        TablerLoading,
        TablerModal
    }
}
</script>
