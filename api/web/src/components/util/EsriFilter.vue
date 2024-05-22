<template>
    <TablerModal size='xl'>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-header'>
            <div class='modal-title'>
                ESRI Layer Filter
            </div>
        </div>
        <div class='modal-body row g-2'>
            <TablerInput
                v-model='filter.query'
                label='SQL Query'
                :disabled='disabled'
            />

            <div class='d-flex px-4'>
                <div class='ms-auto'>
                    <button
                        class='btn btn-secondary'
                        @click='fetch'
                    >
                        Test Query
                    </button>
                </div>
            </div>

            <TablerAlert
                v-if='err'
                :err='err'
                title='Query Error'
            />
            <TablerLoading
                v-if='loading.count'
                desc='Loading Features'
            />
            <template v-else-if='list.features.features'>
                <pre v-text='features' />
            </template>
        </div>
        <div class='modal-footer'>
            <button
                class='btn me-auto'
                @click='$emit("close")'
            >
                Close
            </button>
            <button
                class='btn btn-primary'
                @click='save'
            >
                Save Filter
            </button>
        </div>
    </TablerModal>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerAlert,
    TablerModal,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'EsriFilter',
    components: {
        TablerModal,
        TablerAlert,
        TablerInput,
        TablerLoading
    },
    props: {
        disabled: {
            type: Boolean,
            default: false
        },
        modelValue: {
            type: String,
            default: ''
        },
        layer: {
            type: String
        },
        token: {
            type: String
        }
    },
    emits: [
        'close',
        'update:modelValue'
    ],
    data: function() {
        return {
            err: null,
            loading: {
                count: false
            },
            filter: {
                query: this.modelValue || ''
            },
            list: {
                count: 0,
                features: {}
            }
        }
    },
    computed: {
        features: function() {
            return this.list.features.features.map((feat) => {
                return JSON.stringify(feat);
            }).join('\n');
        }
    },
    methods: {
        save: function() {
            this.$emit('update:modelValue', this.filter.query);
            this.$emit('close');
        },
        fetch: async function() {
            this.err = false;
            this.loading.count = true;

            try {
                const url = stdurl('/api/esri/server/layer');
                url.searchParams.append('query', this.filter.query);
                url.searchParams.append('layer', this.layer);
                if (this.token) url.searchParams.append('token', this.token);

                this.list = await std(url, {
                    method: 'GET',
                    body: this.body
                });
            } catch (err) {
                this.err = err;
            }

            this.loading.count = false;
        },
    }
}
</script>
