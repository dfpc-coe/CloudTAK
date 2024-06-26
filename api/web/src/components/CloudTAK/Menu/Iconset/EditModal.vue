<template>
    <TablerModal size='xl'>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />

        <div class='modal-header'>
            <div
                class='strong d-flex align-items-center'
                v-text='iconset.name || "Unnamed"'
            />
        </div>

        <TablerLoading
            v-if='loading.iconset'
            desc='Loading Iconset'
        />
        <div
            v-else
            class='mx-4 my-4'
        >
            <TablerSchema
                v-model='iconset'
                :schema='schema'
            />

            <div class='d-flex'>
                <div class='ms-auto'>
                    <div
                        class='btn btn-primary'
                        @click='submit'
                    >
                        Submit
                    </div>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import { mapState } from 'pinia'
import { useProfileStore } from '/src/stores/profile.ts';
import {
    TablerModal,
    TablerLoading,
    TablerSchema
} from '@tak-ps/vue-tabler';

export default {
    name: 'IconsetEdit',
    components: {
        TablerModal,
        TablerLoading,
        TablerSchema,
    },
    emits: [
        'close'
    ],
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
    computed: {
        ...mapState(useProfileStore, ['profile']),
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
        flipAccess: async function() {
            const url = await stdurl(`/api/iconset/${this.$route.params.iconset ||''}`);

            await std(url, {
                method: this.$route.params.iconset ? 'PATCH' : 'POST',
                body: this.iconset
            });

            this.$emit('close');
        },
        submit: async function() {
            const url = await stdurl(`/api/iconset/${this.$route.params.iconset ||''}`);

            await std(url, {
                method: this.$route.params.iconset ? 'PATCH' : 'POST',
                body: this.iconset
            });

            this.$emit('close');
        },
        fetchSchema: async function() {
            const url = await stdurl(`/api/schema`);
            url.searchParams.append('method', this.$route.params.iconset ? 'PATCH' : 'POST');
            url.searchParams.append('url', this.$route.params.iconset ? '/iconset/:iconset' : '/iconset');
            this.schema = (await std(url)).body;
        },
    },
}
</script>
