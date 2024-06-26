<template>
    <div>
        <div class='card-header bg-white sticky-top'>
            <h3 class='card-title'>
                Style Overrides
            </h3>
            <div class='ms-auto btn-list'>
                <IconSettings
                    v-if='disabled'
                    v-tooltip='"Edit Style"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='disabled = false'
                />
                <template v-else-if='!loading.save'>
                    <div class='btn-list d-flex align-items-center'>
                        <TablerToggle
                            v-model='enabled'
                            label='Styling Enabled'
                        />

                        <div
                            class='btn btn-primary btn-icon px-2'
                            @click='saveLayer'
                        >
                            <IconDeviceFloppy
                                v-tooltip='"Save Style"'
                                :size='32'
                                :stroke='1'
                            />
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <TablerLoading
            v-if='loading.save'
            desc='Saving Styles'
        />
        <TablerLoading
            v-else-if='loading.init'
            desc='Loading Styles'
        />
        <TablerNone
            v-else-if='!enabled'
            label='Style Overrides'
            :create='false'
        />
        <template v-else>
            <div class='card-body'>
                <StyleSingle
                    v-model='style'
                    :schema='layer.schema'
                    :disabled='disabled'
                />
            </div>

            <div class='col-12 d-flex align-items-center card-header'>
                <h3 class='card-title'>
                    Query Mode
                </h3>
                <div class='ms-auto btn-list'>
                    <button
                        class='btn'
                        @click='help("query")'
                    >
                        <IconHelp
                            v-tooltip='"JSONata Help"'
                            :size='32'
                            :stroke='1'
                        />
                    </button>
                    <button
                        v-if='query !== null'
                        class='btn'
                        @click='query = null'
                    >
                        <IconX
                            v-tooltip='"Return to list"'
                            :size='32'
                            :stroke='1'
                        />
                    </button>
                    <template v-if='!disabled'>
                        <button
                            v-if='query === null'
                            class='btn'
                            @click='newQuery'
                        >
                            <IconPlus
                                v-tooltip='"New Query"'
                                :size='32'
                                :stroke='1'
                            />
                        </button>
                    </template>
                </div>
            </div>
            <template v-if='query === null && !queries.length'>
                <TablerNone
                    label='Queries'
                    :create='false'
                    @create='newQuery'
                />
            </template>
            <template v-if='query === null && queries'>
                <div class='list-group list-group-flush px-2 py-2'>
                    <div
                        v-for='(q, q_idx) in queries'
                        :key='q_idx'
                        class='my-1'
                    >
                        <div
                            class='cursor-pointer hover-light list-group-item list-group-item-action'
                            @click='openQuery(q_idx)'
                        >
                            <div class='d-flex'>
                                <div
                                    class='align-self-center'
                                    v-text='q.query'
                                />
                                <div class='ms-auto'>
                                    <IconTrash
                                        v-if='!disabled'
                                        :size='32'
                                        :stroke='1'
                                        @click.stop='queries.splice(q_idx, 1)'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else-if='query !== null'>
                <div class='card-body'>
                    <div class='col-md-12 hover-light rounded px-2 py-2'>
                        <TablerInput
                            v-model='queries[query].query'
                            :disabled='disabled'
                            placeholder='JSONata Query'
                            label='JSONata Query'
                            :error='error_query'
                        />
                    </div>

                    <StyleSingle
                        v-model='queries[query].styles'
                        :schema='layer.schema'
                        :disabled='disabled'
                    />
                </div>
            </template>
        </template>
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    IconX,
    IconPlus,
    IconHelp,
    IconTrash,
    IconSettings,
    IconDeviceFloppy
} from '@tabler/icons-vue'
import jsonata from 'jsonata';
import {
    TablerInput,
    TablerToggle,
    TablerNone,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import StyleSingle from './utils/StyleSingle.vue';

export default {
    name: 'LayerStyles',
    components: {
        IconX,
        IconPlus,
        IconHelp,
        StyleSingle,
        TablerInput,
        IconTrash,
        TablerLoading,
        TablerToggle,
        TablerNone,
        IconSettings,
        IconDeviceFloppy
    },
    props: {
        layer: {
            type: Object,
            required: true
        },
    },
    emits: [
        'layer'
    ],
    data: function() {
        return {
            disabled: true,
            loading: {
                init: true,
                save: false
            },
            enabled: this.layer.enabled_styles,
            style: {
                callsign: '',
                remarks: '',
                links: [],
            },
            queries: [],
            query: null,
        };
    },
    computed: {
        error_query: function() {
            if (!this.query) return '';

            try {
                jsonata(this.query.query)
                return '';
            } catch (err) {
                return err.message;
            }
        }
    },
    watch: {
        mode: function() {
            if (this.mode === "disabled") this.enabled = false;
            else this.enabled = true;
        }
    },
    mounted: function() {
        this.reload();
        this.loading.init = false;
    },
    methods: {
        reload: function() {
            const clone = JSON.parse(JSON.stringify(this.layer.styles));
            this.queries = clone.queries || [];
            delete clone.queries;

            this.style = Object.assign(this.style, JSON.parse(JSON.stringify(this.layer.styles)));

            if (!this.enabled) this.mode = "disabled";

            this.disabled = true;
        },
        help: function(topic) {
            if (topic === "query") {
                window.open('http://docs.jsonata.org/simple', '_blank');
            }
        },
        newQuery: function() {
            this.queries.push({
                query: '',
                styles: {}
            })
            this.query = this.queries.length - 1;
        },
        saveLayer: async function() {
            this.loading.save = true;

            try {
                const layer = await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}`, {
                    method: 'PATCH',
                    body: {
                        enabled_styles: this.enabled,
                        styles: {
                            ...this.style,
                            queries: this.queries
                        }
                    }
                });

                this.disabled = true;
                this.loading.save = false;
                this.query = null;

                this.$emit('layer', layer);
            } catch (err) {
                this.loading.save = false;
                throw err;
            }
        },
        openQuery: function(idx) {
            this.query = idx
        }
    }
}
</script>
