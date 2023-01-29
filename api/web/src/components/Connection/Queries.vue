<template>
<div class='card'>
    <div class='card-header'>
        <div class='row row-cards'>
            <div class='col-md-8'>
                <h3 class='card-title'>Notification Queries</h3>
            </div>
            <div class='col-md-4'>
                <div class='d-flex'>
                    <div class='ms-auto'>
                        <div class='btn-list'>
                            <template v-if='!disabled'>
                                <div @click='help("query")' class='cursor-pointer'>
                                    <HelpIcon/>
                                </div>
                                <div v-if='query === null' @click='newQuery' class='cursor-pointer'>
                                    <PlusIcon/>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

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
    </template>
    <template v-else-if='query === null && !queries.length'>
        <None label='Query' :create='!disabled' @create='newQuery'/>
    </template>
    <template v-else-if='typeof query === "object"'>
        <div class='card-body'>
            <TablerInput :disabled='disabled' v-model='query.query' placeholder='JSONata Query' label='JSONata Query' :error='errors.query'/>

            <div class='d-flex'>
                <div @click='query = null' class='btn'>Cancel</div>
                <div class='ms-auto'>
                    <div v-if='!disabled' @click='saveQuery' class='btn btn-primary'>Save Query</div>
                </div>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import jsonata from 'jsonata';
import {
    PlusIcon,
    HelpIcon,
    TrashIcon
} from 'vue-tabler-icons'
import {
    TablerInput
} from '@tak-ps/vue-tabler';
import None from '../cards/None.vue';

export default {
    name: 'ConnectionQueries',
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
        },
        basic: {
            deep: true,
            handler: function() {
                if (this.mode === 'basic') {
                    this.$emit('update:modelValue', this.basic);
}
            }
        },
        queries: {
            deep: true,
            handler: function() {
                if (this.mode === 'query') {
                    this.$emit('update:modelValue', {
                        queries: this.queries
                    });
                }
            }
        }
    },
    mounted: function() {
        this.global_enabled = this.enabled;

        if (this.modelValue.queries) {
            this.queries = this.modelValue.queries;
            this.mode = 'query';
        } else {
            this.basic = this.modelValue;
            this.mode = 'basic';
        }
    },
    methods: {
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
        PlusIcon,
        HelpIcon,
        TablerInput,
        TrashIcon
    }
}
</script>
