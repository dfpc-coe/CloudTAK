<template>
    <TablerModal size='xl'>
        <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class='modal-header'>
            <div class='modal-title'>ESRI Layer Filter</div>
        </div>
        <div class="modal-body row g-2">
            <TablerInput label='SQL Query' :disabled='disabled' v-model='filter.query'/>

            <div class='d-flex px-4'>
                <div class='ms-auto'>
                    <button @click='fetch' class='btn btn-secondary'>Test Query</button>
                </div>
            </div>

            <TablerLoading v-if='loading.count' desc='Loading Features'/>
            <template v-else-if='list.features.features'>
                <pre v-text='features'/>
            </template>
        </div>
        <div class="modal-footer">
            <button @click='$emit("close")' class="btn me-auto">Close</button>
            <button @click='save' class="btn btn-primary">Save Filter</button>
        </div>
    </TablerModal>
</template>

<script>
import {
    TablerModal,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'EsriFilter',
    props: {
        disabled: {
            type: Boolean,
            default: false
        },
        layer: {
            type: String
        },
        token: {
            type: String
        }
    },
    computed: {
        features: function() {
            return this.list.features.features.map((feat) => {
                return JSON.stringify(feat);
            }).join('\n');
        }
    },
    data: function() {
        return {
            loading: {
                count: false
            },
            filter: {
                query: ''
            },
            list: {
                count: 0,
                features: {}
            }
        }
    },
    methods: {
        save: function() {
            this.$emit('filter', this.filter.query);
            this.$emit('close');
        },
        fetch: async function() {
            this.loading.count = true;

            const url = window.stdurl('/api/sink/esri/server/layer');
            url.searchParams.append('query', this.filter.query);
            url.searchParams.append('layer', this.layer);
            url.searchParams.append('token', this.token);

            this.list = await window.std(url, {
                method: 'GET',
                body: this.body
            });

            this.loading.count = false;
        },
    },
    components: {
        TablerModal,
        TablerInput,
        TablerLoading
    }
}
</script>
