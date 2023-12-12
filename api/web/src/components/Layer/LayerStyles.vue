<template>
<div>
    <div class='card-header'>
        <h3 class='card-title'>Style Overrides</h3>
        <div class='ms-auto btn-list'>
            <IconSettings v-if='disabled' @click='disabled = false' class='cursor-pointer'/>
            <template v-else>
                <div class='row d-flex mx-2'>
                    <div class="btn-group" role="group">
                        <input v-model='mode' type="radio" class="btn-check" name="type-toolbar" value='basic'>
                        <label @click='mode="basic"' class="btn btn-icon px-3">
                            <IconAbc/> Basic
                        </label>
                        <input v-model='mode' type="radio" class="btn-check" name="type-toolbar" value='query'>
                        <label @click='mode="query"' class="btn btn-icon px-3">
                            <IconCode/> Query
                        </label>
                        <input v-model='mode' type="radio" class="btn-check" name="type-toolbar" value='disabled'>
                        <label @click='mode="disabled"' class="btn btn-icon px-3">
                            <IconBrushOff/> Disabled
                        </label>
                    </div>
                </div>
            </template>
        </div>
    </div>

    <TablerLoading v-if='loading.save' desc='Saving Styles'/>
    <TablerLoading v-else-if='loading.init' desc='Loading Styles'/>
    <TablerNone v-else-if='!enabled && disabled' label='Style Overrides' :create='false'/>
    <template v-else>
        <template v-if='!enabled'>
            <TablerNone label='Style Overrides' :create='false'/>
            <div class="col-12 py-2 px-2 d-flex">
                <div class='ms-auto'>
                    <button @click='saveLayer' class='btn btn-primary'>Save</button>
                </div>
            </div>
        </template>
        <template v-if='mode === "query"'>
            <div class='col-12 d-flex card-header'>
                <h3 class='card-title'>
                    Query Mode
                </h3>
                <div class='ms-auto btn-list'>
                    <template v-if='mode === "query" && !disabled'>
                        <button @click='help("query")' class='btn'>
                            <IconHelp/>
                        </button>
                        <button v-if='query === null' @click='newQuery' class='btn'>
                            <IconPlus/>
                        </button>
                    </template>
                    <template v-else-if='mode === "query"'>
                        <button @click='help("query")' class='btn'>
                            <IconHelp/>
                        </button>
                        <button v-if='query' @click='query = null' class='btn'>
                            <IconX/>
                        </button>
                    </template>
                </div>
            </div>
            <template v-if='query === null && queries.length'>
                <div class='card-body'>
                    <div class="list-group list-group-flush">
                        <div :key='q_idx' v-for='(q, q_idx) in queries' class='my-1'>
                            <div @click='openQuery(q_idx)' class="cursor-pointer list-group-item list-group-item-action">
                                <div class='d-flex'>
                                    <div class='align-self-center' v-text='q.query'></div>
                                    <div class='ms-auto'>
                                        <div v-if='!disabled' @click.stop='queries.splice(q_idx, 1)' class='btn'><IconTrash/></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if='!disabled' class="col-12 py-2 px-2 d-flex">
                        <div class='ms-auto'>
                            <button @click='saveLayer(query)' class='btn btn-primary'>Save</button>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else-if='query === null && !queries.length'>
                <TablerNone label='Queries' :create='false' @create='newQuery'/>
            </template>
            <template v-else-if='query && typeof query === "object"'>
                <div class='card-body'>
                    <TablerInput :disabled='disabled' v-model='query.query' placeholder='JSONata Query' label='JSONata Query' :error='errors.query'/>

                    <StyleSingle :schema='layer.schema' :disabled='disabled' v-model='query.styles'/>

                    <div v-if='!disabled' class="col-12 py-2 px-2 d-flex">
                        <button @click='query = null' class='btn'>Cancel</button>
                        <div class='ms-auto'>
                            <button @click='saveLayer(query)' class='btn btn-primary'>Save</button>
                        </div>
                    </div>
                </div>
            </template>
        </template>
        <template v-else-if='mode === "basic"'>
            <StyleSingle :schema='layer.schema' :disabled='disabled' v-model='basic'/>

            <div v-if='!disabled' class="col-12 py-2 px-2 d-flex">
                <button v-if='mode === "single"' @click='reload' class='btn'>Cancel</button>
                <button v-else @click='query = null' class='btn'>Cancel</button>
                <div class='ms-auto'>
                    <button @click='saveLayer' class='btn btn-primary'>Save</button>
                </div>
            </div>
        </template>
    </template>
</div>
</template>

<script>
import jsonata from 'jsonata';
import {
    IconX,
    IconAbc,
    IconCode,
    IconPlus,
    IconHelp,
    IconTrash,
    IconSettings,
    IconBrushOff,
} from '@tabler/icons-vue'
import {
    TablerInput,
    TablerNone,
    TablerToggle,
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
            mode: 'basic',
            disabled: true,
            loading: {
                init: true,
                save: false
            },
            enabled: this.layer.enabled_styles,
            query: null,
            queries: [],
            basic: {},
            errors: {
                query: ''
            }
        };
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
            if (this.layer.styles.queries) {
                this.queries = this.layer.styles.queries;
                this.mode = 'query';
            } else {
                this.basic = this.layer.styles;
                this.mode = 'basic';
            }

            if (!this.enabled) this.mode = "disabled";

            this.disabled = true;
        },
        help: function(topic) {
            if (topic === "query") {
                window.open('http://docs.jsonata.org/simple', '_blank');
            }
        },
        newQuery: function() {
            this.query = {
                query: '',
                styles: {}
            }
        },
        saveLayer: async function(query = null) {
            this.loading.save = true;

            if (query) this.queries.push(query);

            let styles = {}
            if (this.mode === 'basic') {
                styles = this.basic;
            } else if (this.mode === 'query') {
                styles = {
                    queries: this.queries
                }
            }

            try {
                const layer = await window.std(`/api/layer/${this.$route.params.layerid}`, {
                    method: 'PATCH',
                    body: {
                        enabled_styles: this.enabled,
                        styles
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
        IconAbc,
        IconPlus,
        IconHelp,
        StyleSingle,
        TablerInput,
        TablerToggle,
        IconTrash,
        TablerLoading,
        TablerNone,
        IconSettings,
        IconBrushOff,
    }
}
</script>
