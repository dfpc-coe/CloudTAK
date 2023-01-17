<template>
<div class='card'>
    <div class='card-header'>
        <div class='row row-cards'>
            <div class='col-md-4'>
                <h3 class='card-title'>Style Overrides</h3>
                <div class='ms-auto'>
                    <div class='d-flex my-2'>
                        <span class='px-2'>Enabled</span>
                        <label class="form-check form-switch">
                            <input :disabled='disabled' v-model='global_enabled' class="form-check-input" type="checkbox">
                        </label>
                    </div>
                </div>
            </div>
            <div class='col-md-4'>
                <div v-if='global_enabled' class="d-flex justify-content-center">
                    <div class="btn-list">
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
                    </div>
                </div>
            </div>
            <div class='col-md-4'>
                <div class='d-flex'>
                    <div class='ms-auto'>
                        <button v-if='mode === "query"' @click='newQuery' class='btn'>New Query</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div v-if='!global_enabled' class='card-body'>
        Style Overrides are disabled
    </div>
    <template v-else-if='mode === "query"'>
        <template v-if='query === null && queries.length'>
            <div class='card-body'>
                <div class="list-group list-group-flush">
                    <div :key='q_idx' v-for='(q, q_idx) in queries'>
                        <div @click='openQuery(q_idx)' class="cursor-pointer list-group-item list-group-item-action">
                            <div class='d-flex'>
                                <div class='align-self-center' v-text='q.query'></div>
                                <div class='ms-auto'>
                                    <div @click.stop='removeQuery(idx)' class='btn'><TrashIcon/></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>
        <template v-else-if='query === null && !queries.length'>
            <None label='Query' @create='newQuery'/>
        </template>
        <template v-else-if='typeof query === "object"'>
            <div class='card-body'>
                <TablerInput v-model='query.query' placeholder='JSONata Query' label='JSONata Query' :error='errors.query'/>

                <StylesSingle v-model='query.style'/>

                <div class='d-flex'>
                    <div @click='query = null' class='btn'>Cancel</div>
                    <div class='ms-auto'>
                        <div @click='saveQuery' class='btn btn-primary'>Save Query</div>
                    </div>
                </div>
            </div>
        </template>
    </template>
    <template v-else>
        <StylesSingle v-model='basic'/>
    </template>
</div>
</template>

<script>
import jsonata from 'jsonata';
import {
    AbcIcon,
    CodeIcon,
    TrashIcon
} from 'vue-tabler-icons'
import {
    TablerInput
} from '@tak-ps/vue-tabler';
import StylesSingle from './Styles/Single.vue';
import None from '../cards/None.vue';

export default {
    name: 'LayerStyles',
    props: {
        modelValue: {
            type: Object,
            default: function() {
                return {};
            },
            required: true
        },
        enabled: {
            type: Boolean,
            default: false
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    data: function() {
        return {
            mode: 'basic',
            global_enabled: null,
            query: null,
            queries: [],
            basic: {},
            errors: {
                query: ''
            }
        };
    },
    watch: {
        global_enabled: function() {
            this.$emit('enabled', this.global_enabled);
        }
    },
    mounted: function() {
        this.global_enabled = this.enabled;

        if (this.modelValue.queries) this.queries = this.modelValue.queries;
        else this.basic = this.modelValue;

    },
    methods: {
        newQuery: function() {
            this.query = {
                query: '',
                styles: {}
            }
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
        None,
        CodeIcon,
        AbcIcon,
        StylesSingle,
        TablerInput,
        TrashIcon
    }
}
</script>
