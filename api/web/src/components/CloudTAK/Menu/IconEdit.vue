<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title' v-text='"Edit: " + icon.name'></div>
            <div class='btn-list'></div>
        </div>
    </div>
    <div class='mx-4'>

    <TablerLoading v-if='loading.icon' desc='Loading Icon'/>
    <div v-else class="card-body">
        <TablerLoading v-if='loading.icon' desc='Loading Icon'/>
        <TablerSchema v-else :schema='schema' v-model='icon'/>

        <div class='d-flex'>
            <div class='ms-auto'>
                <div @click='submit' class='btn btn-primary'>Submit</div>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
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
        TablerDelete,
        TablerLoading,
        TablerSchema,
        IconSettings,
    }
}
</script>
