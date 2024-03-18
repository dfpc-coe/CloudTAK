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

    <TablerLoading v-if='loading.icon' desc='Loading Icon'/>
    <div v-else class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <div class='card-header'>
                            <h3 class='card-title'>Icon <span v-text='$route.params.icon || "New Icon"'/></h3>
                        </div>
                        <div class="card-body">
                            <TablerLoading v-if='loading.icon' desc='Loading Icon'/>
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
    name: 'IconEdit',
    data: function() {
        return {
            loading: {
                icon: true
            },
            schema: {},
            icon: {
                name: '',
                data: ''
            },
        }
    },
    mounted: async function() {
        await this.fetchSchema();

        if (this.$route.params.icon) {
            await this.fetch();
        } else {
            this.loading.icon = false;
        }
    },
    methods: {
        fetch: async function() {
            this.loading.icon = true;
            this.icon = await std(`/api/iconset/${this.$route.params.iconset}/icon/${encodeURIComponent(this.$route.params.icon)}`);
            this.loading.icon = false;
        },
        submit: async function() {
            if (this.$route.params.icon) {
                const url = await stdurl(`/api/iconset/${this.$route.params.iconset}/icon/${encodeURIComponent(this.$route.params.icon)}`);

                await std(url, {
                    method: 'PATCH',
                    body: this.icon
                });
            } else {
                const url = await stdurl(`/api/iconset/${this.$route.params.iconset}/icon`);

                await std(url, {
                    method: 'POST',
                    body: this.icon
                });
            }

            this.$router.push(`/iconset/${this.$route.params.iconset}`);
        },
        fetchSchema: async function() {
            const url = await stdurl(`/api/schema`);
            url.searchParams.append('method', 'POST');
            url.searchParams.append('url', '/iconset/:iconset/icon');
            this.schema = (await std(url)).body;
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
