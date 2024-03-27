<template>
<TablerModal size='xl'>
    <div class="modal-status bg-red"></div>
    <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>

    <div class='modal-header'>
        <div class='strong d-flex align-items-center' v-text='editing.name || "Unnamed"'></div>
    </div>

    <TablerLoading v-if='loading.icon' desc='Loading Icon'/>
    <div v-else class='mx-4 my-4'>
        <TablerSchema :schema='schema' v-model='editing'/>

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
    TablerSchema
} from '@tak-ps/vue-tabler';

export default {
    name: 'IconEdit',
    props: {
        icon: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            loading: {
                icon: true
            },
            schema: {},
            editing: {}
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
            this.editing = await std(`/api/iconset/${this.$route.params.iconset}/icon/${encodeURIComponent(this.icon.name)}`);
            this.loading.icon = false;
        },
        submit: async function() {
            const url = await stdurl(`/api/iconset/${this.$route.params.iconset}/icon/${this.icon.id ? encodeURIComponent(this.icon.name) : ''}`);

            await std(url, {
                method: this.icon.id ? 'PATCH' : 'POST',
                body: this.editing
            });

            this.$emit('close')
        },
        fetchSchema: async function() {
            const url = await stdurl(`/api/schema`);
            url.searchParams.append('method', this.icon.id ? 'PATCH' : 'POST');
            url.searchParams.append('url', this.icon.id ? '/iconset/:iconset/icon/:icon' : '/iconset/:iconset/icon');
            this.schema = (await std(url)).body;
        },
    },
    components: {
        TablerModal,
        TablerLoading,
        TablerSchema,
    }
}
</script>
