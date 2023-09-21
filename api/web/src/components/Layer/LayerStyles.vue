<template>
<div>
    <div class='card-header'>
        <h3 class='card-title'>Style Overrides</h3>
        <div class='ms-auto btn-list'>
            <SettingsIcon v-if='disabled' @click='disabled = false' class='cursor-pointer'/>
        </div>
    </div>

    <TablerLoading v-if='loading.save' desc='Saving Styles'/>
    <TablerLoading v-else-if='loading.init' desc='Loading Styles'/>
    <div v-else-if='!enabled' class='card-body text-center'>
        <TablerToggle label='Styles Enabled' :disabled='disabled' v-model='enabled'/>
        Style Overrides are disabled
    </div>
    <template v-else>
        <template v-if='!disabled'>
            <TablerToggle label='Styles Enabled' :disabled='disabled' v-model='enabled'/>
            <div class='col-md-12'>
                <div class='row d-flex mx-2'>
                    <div v-if='enabled' class="d-flex">
                        <div class="btn-group" role="group">
                            <input v-model='mode' type="radio" class="btn-check" name="type-toolbar" value='basic'>
                            <label @click='mode="basic"' class="btn btn-icon px-3">
                                <AbcIcon/> Basic
                            </label>
                            <input v-model='mode' type="radio" class="btn-check" name="type-toolbar" value='query'>
                            <label @click='mode="query"' class="btn btn-icon px-3">
                                <CodeIcon/> Query
                            </label>
                        </div>
                        <div class='ms-auto btn-list'>
                            <template v-if='mode === "query" && !disabled'>
                                <button @click='help("query")' class='btn'>
                                    <HelpIcon/>
                                </button>
                                <button v-if='query === null' @click='newQuery' class='btn'>
                                    <PlusIcon/>
                                </button>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </template>
        <template v-if='mode === "query"'>
            <template v-if='query === null && queries.length'>
                <div class='card-body'>
                    <div class="list-group list-group-flush">
                        <div :key='q_idx' v-for='(q, q_idx) in queries'>
                            <div @click='openQuery(q_idx)' class="cursor-pointer list-group-item list-group-item-action">
                                <div class='d-flex'>
                                    <div class='align-self-center' v-text='q.query'></div>
                                    <div class='ms-auto'>
                                        <div v-if='!disabled' @click.stop='removeQuery(idx)' class='btn'><TrashIcon/></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-if='!disabled' class="col-12 py-2 px-2 d-flex">
                    <button @click='reload' class='btn'>Cancel</button>
                    <div class='ms-auto'>
                        <button @click='saveLayer' class='btn btn-primary'>Save</button>
                    </div>
                </div>
            </template>
            <template v-else-if='query === null && !queries.length'>
                <TablerNone label='Queries' :create='!disabled' @create='newQuery'/>
            </template>
            <template v-else-if='query && typeof query === "object"'>
                <div class='card-body'>
                    <TablerInput :disabled='disabled' v-model='query.query' placeholder='JSONata Query' label='JSONata Query' :error='errors.query'/>

                    <StylesSingle :schema='layer.schema' :disabled='disabled' v-model='query.styles'/>

                    <div class='d-flex'>
                        <div @click='query = null' class='btn'>Cancel</div>
                        <div class='ms-auto'>
                            <div v-if='!disabled' @click='saveQuery' class='btn btn-primary'>Save Query</div>
                        </div>
                    </div>
                </div>
            </template>
        </template>
        <template v-else>
            <StylesSingle :schema='layer.schema' :disabled='disabled' v-model='basic'/>

            <div v-if='!disabled' class="col-12 py-2 px-2 d-flex">
                <button @click='reload' class='btn'>Cancel</button>
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
    AbcIcon,
    CodeIcon,
    PlusIcon,
    HelpIcon,
    TrashIcon,
    SettingsIcon,
} from 'vue-tabler-icons'
import {
    TablerInput,
    TablerNone,
    TablerToggle,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import StylesSingle from './utils/SingleStyle.vue';

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
        saveLayer: async function() {
            this.loading.save = true;

            let styles = {}
            if (this.mode === 'basic') {
                styles = this.basic;
            } else if (this.mode === 'query') {
                styles = {
                    queries: this.queries
                }
            }

            const layer = await window.std(`/api/layer/${this.$route.params.layerid}`, {
                method: 'PATCH',
                body: {
                    enabled_styles: this.enabled,
                    styles
                }
            });

            this.disabled = true;
            this.loading.save = false;

            this.$emit('layer', layer);
        },
        saveQuery: function() {
            try {
                jsonata(this.query.query);
            } catch (err) {
                this.errors.query = err.message;
                return;
            } finally {
                this.errors.query = '';
            }

            if (this.query.id !== undefined) {
                delete this.query.id;
                this.queries.splice(this.query.id, 1, this.query);
            } else {
                this.queries.push(this.query);
            }

            this.query = null;
        },
        removeQuery: function(idx) {
            this.queries.splice(idx, 1);
        },
        openQuery: function(idx) {
            this.query = {
                id: idx,
                ...this.queries[idx]
            };
        }
    },
    components: {
        CodeIcon,
        AbcIcon,
        PlusIcon,
        HelpIcon,
        StylesSingle,
        TablerInput,
        TablerToggle,
        TrashIcon,
        TablerLoading,
        TablerNone,
        SettingsIcon,
    }
}
</script>
