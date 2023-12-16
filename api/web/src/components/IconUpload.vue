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
                            <TablerSchema v-else :schema='schema' v-model='icon'/>

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
    name: 'IconEdit',
    data: function() {
        return {
            loading: {
                iconset: true
            },
            schema: {},
            icon: {
                name: '',
                data: ''
            },
            iconset: {}
        }
    },
    mounted: async function() {
        await this.fetchSchema();

        if (this.$route.params.icon) {
            await this.fetch();
        } else {
            this.loading.iconset = false;
        }
    },
    methods: {
        fetch: async function() {
            this.loading.iconset = true;
            this.iconset = await window.std(`/api/iconset/${this.$route.params.icon}`);
            this.loading.iconset = false;
        },
        submit: async function() {
            const url = await window.stdurl(`/api/iconset/${this.$route.params.icon}/icon`);

            await window.std(url, {
                method: 'POST',
                body: this.icon
            });

            this.$router.push(`/iconset/${this.iconset.uid}`);
        },
        fetchSchema: async function() {
            const url = await window.stdurl(`/api/schema`);
            url.searchParams.append('method', 'POST');
            url.searchParams.append('url', '/iconset/:iconset/icon');
            this.schema = (await window.std(url)).body;
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
