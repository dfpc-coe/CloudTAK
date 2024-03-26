<template>
<TablerModal size='xl'>
    <div class="modal-status bg-red"></div>
    <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>

    <div class='modal-header'>
        <div class='strong d-flex align-items-center' v-text='iconset.name || "Unnamed"'></div>
    </div>

    <TablerLoading v-if='loading.iconset' desc='Loading Iconset'/>
    <div v-else class='mx-4 my-4'>
        <TablerSchema :schema='schema' v-model='iconset'/>

        <div class='d-flex'>
            <div class='ms-auto'>
                <div @click='submit' class='btn btn-primary'>Submit</div>
            </div>
        </div>
    </div>
</TablerModal>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerModal,
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
                scope: 'user'
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

            this.$router.push(`/menu/iconset/${iconset.uid}`);
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

            this.$router.push('/menu/iconsets');
        },
    },
    components: {
        TablerModal,
        TablerDelete,
        TablerLoading,
        TablerSchema,
        IconSettings,
    }
}
</script>
