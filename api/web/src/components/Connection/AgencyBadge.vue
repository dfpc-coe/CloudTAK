<template>
    <div>
        <span
            v-if='connection.agency'
            class='badge border text-white cursor-pointer'
            :class='{
                "bg-blue": !muted,
                "bg-blue-lt": muted
            }'
            style='height: 20px'
            @click='info = true'
            v-text='`Agency`'
        />
        <span
            v-else
            class='badge border text-white'
            :class='{
                "bg-red": !muted,
                "bg-red-lt": muted
            }'
            style='height: 20px'
            v-text='`Admin`'
        />

        <TablerModal v-if='info'>
            <div class='modal-status bg-yellow' />
            <button
                type='button'
                class='btn-close'
                aria-label='Close'
                @click='info = false'
            />

            <TablerLoading
                v-if='loading'
                desc='Loading Agency...'
            />
            <template v-else>
                <div class='modal-header'>
                    <div
                        class='modal-title'
                        v-text='agency.name'
                    />
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
                <button
                    class='btn btn-primary'
                    @click='info = false'
                >
                    Close
                </button>
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
    components: {
        TablerLoading,
        TablerModal
    },
    props: {
        connection: {
            type: Object,
            required: true
        },
        muted: {
            type: Boolean,
            default: false
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
    }
}
</script>
