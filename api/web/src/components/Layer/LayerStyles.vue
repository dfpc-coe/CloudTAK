<template>
<div>
    <div class='card-header bg-white sticky-top'>
        <h3 class='card-title'>Style Overrides</h3>
        <div class='ms-auto btn-list'>
            <IconSettings v-if='disabled' @click='disabled = false' size='32' class='cursor-pointer' v-tooltip='"Edit Style"'/>
            <template v-else-if='!loading.save'>
                <div class='btn-list d-flex align-items-center'>
                    <TablerToggle label='Styling Enabled' v-model='enabled'/>

                    <div @click='saveLayer' class="btn btn-primary btn-icon px-2">
                        <IconDeviceFloppy size='32' v-tooltip='"Save Style"'/>
                    </div>
                </div>
            </template>
        </div>
    </div>

    <TablerLoading v-if='loading.save' desc='Saving Styles'/>
    <TablerLoading v-else-if='loading.init' desc='Loading Styles'/>
    <TablerNone v-else-if='!enabled' label='Style Overrides' :create='false'/>
    <template v-else>
        <div class='card-body'>
            <StyleSingle :schema='layer.schema' :disabled='disabled' v-model='style'/>
        </div>

        <div class='col-12 d-flex align-items-center card-header'>
            <h3 class='card-title'>
                Query Mode
            </h3>
            <div class='ms-auto btn-list'>
                <button @click='help("query")' class='btn'>
                    <IconHelp size='32' v-tooltip='"JSONata Help"'/>
                </button>
                <button v-if='query' @click='query = null' class='btn'>
                    <IconX size='32' v-tooltip='"Return to list"'/>
                </button>
                <template v-if='!disabled'>
                    <button v-if='query === null' @click='newQuery' class='btn'>
                        <IconPlus size='32' v-tooltip='"New Query"'/>
                    </button>
                </template>
            </div>
        </div>
        <template v-if='query === null && !queries.length'>
            <TablerNone label='Queries' :create='false' @create='newQuery'/>
        </template>
        <template v-if='query === null && queries'>
            <div class="list-group list-group-flush px-2 py-2">
                <div :key='q_idx' v-for='(q, q_idx) in queries' class='my-1'>
                    <div @click='openQuery(q_idx)' class="cursor-pointer hover-light list-group-item list-group-item-action">
                        <div class='d-flex'>
                            <div class='align-self-center' v-text='q.query'></div>
                            <div class='ms-auto'>
                                <IconTrash v-if='!disabled' @click.stop='queries.splice(q_idx, 1)' size='32'/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>
        <template v-else-if='query && typeof query === "object"'>
            <div class='card-body'>
                <div class='col-md-12 hover-light rounded px-2 py-2'>
                    <TablerInput
                        :disabled='disabled'
                        v-model='query.query'
                        placeholder='JSONata Query'
                        label='JSONata Query'
                        :error='error_query'
                    />
                </div>

                <StyleSingle :schema='layer.schema' :disabled='disabled' v-model='query.styles'/>
            </div>
        </template>
    </template>
</div>
</template>

<script>
import { std } from '/src/std.ts';
import StyleTemplate from './utils/StyleTemplate.vue';
import {
    IconX,
    IconCode,
    IconPlus,
    IconHelp,
    IconTrash,
    IconSettings,
    IconBrushOff,
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
    props: {
        layer: {
            type: Object,
            required: true
        },
    },
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
            this.query = this.queries[this.queries.length -1];
        },
        saveLayer: async function(query = null) {
            this.loading.save = true;

            try {
                const layer = await std(`/api/layer/${this.$route.params.layerid}`, {
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
            this.query = {
                id: idx,
                ...this.queries[idx]
            };
        }
    },
    components: {
        IconX,
        IconCode,
        IconPlus,
        IconHelp,
        StyleTemplate,
        StyleSingle,
        TablerInput,
        IconTrash,
        TablerLoading,
        TablerToggle,
        TablerNone,
        IconSettings,
        IconBrushOff,
        IconDeviceFloppy
    }
}
</script>
