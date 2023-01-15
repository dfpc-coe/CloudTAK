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
                        <button v-if='mode === "query"' @click='query = {}' class='btn'>New Query</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div v-if='!global_enabled' class='card-body'>
        Style Overrides are disabled
    </div>
    <template v-else-if='mode === "query" && !query'>
        <div class='card-body'>
            <div class="list-group list-group-flush">
                <div :key='q_idx' v-for='(q, q_idx) in queries'>
                    <a @click='query = q_idx' class="cursor-pointer list-group-item list-group-item-action" v-text='q.query'></a>
                </div>
            </div>
        </div>
    </template>
    <template v-else-if='mode === "query" && typeof query === "object"'>
        <div class='card-body'>
            <TablerInput v-model='query.query' placeholder='JSONata Query' label='JSONata Query'/>

            <StylesSingle v-model='query'/>
        </div>
    </template>
    <template v-else>
        <StylesSingle v-model='basic'/>
    </template>
</div>
</template>

<script>
import {
    AbcIcon,
    CodeIcon
} from 'vue-tabler-icons'
import {
    TablerInput
} from '@tak-ps/vue-tabler';
import StylesSingle from './Styles/Single.vue';

export default {
    name: 'StyleUtil',
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
            basic: {}
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
    components: {
        CodeIcon,
        AbcIcon,
        StylesSingle,
        TablerInput
    }
}
</script>
