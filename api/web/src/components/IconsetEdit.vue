<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <TablerBreadCrumb/>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <TablerLoading v-if='loading.iconset' desc='Loading Iconset'/>
    <div v-else class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <div class='card-header'>
                            <h3 class='card-title'>Iconset <span v-text='iconset.uid'/></h3>
                        </div>
                        <div class="card-body">
                            <TablerLoading v-if='loading.iconset' desc='Loading Iconset'/>
                            <TablerSchema v-else :schema='schema' v-model='iconset'/>

                            <div class='d-flex'>
                                <div class='ms-auto'>
                                    <div @click='submit' class='btn btn-primary'>Submit</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import {
    TablerBreadCrumb,
    TablerLoading,
    TablerDelete,
    TablerSchema
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
} from '@tabler/icons-vue';

export default {
    name: 'IconsetEdit',
    data: function() {
        return {
            loading: {
                iconset: true
            },
            schema: {},
            iconset: {

            }
        }
    },
    mounted: async function() {
        await this.fetchSchema();

        if (this.$route.params.iconset) {
            await this.fetch();
        } else {
            this.loading.iconset = false;
        }
    },
    methods: {
        fetch: async function() {
            this.loading.iconset = true;
            this.iconset = await std(`/api/iconset/${this.$route.params.iconset}`);
            this.loading.iconset = false;
        },
        submit: async function() {
            const url = await stdurl(`/api/iconset/${this.$route.params.iconset ||''}`);

            const iconset = await std(url, {
                method: this.$route.params.iconset ? 'PATCH' : 'POST',
                body: this.iconset
            });

            this.$router.push(`/iconset/${iconset.uid}`);
        },
        fetchSchema: async function() {
            const url = await stdurl(`/api/schema`);
            url.searchParams.append('method', this.$route.params.iconset ? 'PATCH' : 'POST');
            url.searchParams.append('url', this.$route.params.iconset ? '/iconset/:iconset' : '/iconset');
            this.schema = (await std(url)).body;
        },
        Icondeleteset: async function() {
            await std(`/api/iconset/${this.$route.params.iconset}`, {
                method: 'DELETE'
            });

            this.$router.push('/iconset');
        },
    },
    components: {
        PageFooter,
        TablerBreadCrumb,
        TablerDelete,
        TablerLoading,
        TablerSchema,
        IconSettings,
    }
}
</script>
