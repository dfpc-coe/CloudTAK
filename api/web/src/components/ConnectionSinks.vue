<template>
    <div style='overflow: auto;'>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex text-white'>
                            <TablerBreadCrumb />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class='page-body'>
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <TablerLoading v-if='loading' />
                    </div>

                    <div class='col-lg-12'>
                        <ConnectionSinks
                            v-if='connection.id'
                            :connection='connection'
                        />
                    </div>
                </div>
            </div>
        </div>
        <PageFooter />
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import ConnectionSinks from './Connection/Sinks.vue';
import {
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionSinkList',
    components: {
        PageFooter,
        TablerBreadCrumb,
        TablerLoading,
        ConnectionSinks,
    },
    data: function() {
        return {
            loading: true,
            connection: {}
        }
    },
    mounted: async function() {
        await this.fetch();

    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.connection = await std(`/api/connection/${this.$route.params.connectionid}`);
            this.loading = false;
        },
    }
}
</script>
