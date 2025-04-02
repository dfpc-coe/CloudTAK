<template>
    <div>
        <div class='d-flex align-items-center'>
            <label class='mx-1 mb-1'>Layer Selection</label>
        </div>
        <div class='card'>
            <div class='card-body'>
                <TablerLoading
                    v-if='loading.main'
                    :inline='true'
                    desc='Loading Layers'
                />
                <template v-else-if='selected.id'>
                    <div class='col-12 d-flex align-items-center'>
                        <div v-text='selected.name' />
                        <div class='ms-auto'>
                            <IconTrash
                                v-if='selected.id && list.total > 1'
                                v-tooltip='"Remove Layer"'
                                :size='32'
                                stroke='1'
                                class='cursor-pointer'
                                @click='selected = {}'
                            />
                        </div>
                    </div>
                </template>
                <template v-else>
                    <TablerInput
                        v-model='paging.filter'
                        placeholder='Layer Filter...'
                    />

                    <div
                        v-if='loading.list'
                        class='card-body'
                    >
                        <TablerLoading desc='Loading Layers' />
                    </div>
                    <TablerNone
                        v-else-if='list.total === 0'
                        :create='false'
                        :compact='true'
                        label='Layers'
                    />
                    <template
                        v-for='layer in list.items'
                        v-else
                    >
                        <div
                            class='hover-light px-2 py-2 cursor-pointer row rounded'
                            @click='selected = layer'
                        >
                            <div class='col-md-4'>
                                <span v-text='layer.name' />
                            </div>

                            <div
                                class='col-md-8'
                                v-text='layer.description'
                            />
                        </div>
                    </template>
                </template>
            </div>
            <div
                v-if='list.total > paging.limit && !selected.id'
                class='card-footer d-flex'
            >
                <div class='ms-auto'>
                    <TablerPager
                        :page='paging.page'
                        :total='list.total'
                        :limit='paging.limit'
                        @page='paging.page = $event'
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconTrash,
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerInput,
    TablerPager,
    TablerNone,
} from '@tak-ps/vue-tabler';

export default {
    name: 'LayerSelect',
    components: {
        IconTrash,
        TablerInput,
        TablerPager,
        TablerNone,
        TablerLoading
    },
    props: {
        modelValue: Number,
        disabled: {
            type: Boolean,
            default: false
        }
    },
    emits: [
        'update:modelValue'
    ],
    data: function() {
        return {
            loading: {
                main: true,
                list: true,
            },
            selected: {
                id: '',
                name: ''
            },
            paging: {
                filter: '',
                limit: 10,
                page: 0
            },
            list: {
                total: 0,
                items: []
            }
        }
    },
    watch: {
        selected: {
            deep: true,
            handler: function() {
                this.$emit('update:modelValue', this.selected.id);
            }
        },
        modelValue: function() {
            if (this.modelValue) this.fetch();
        },
        paging: {
            deep: true,
            handler: async function() {
                await this.listData();
            },
        }
    },
    mounted: async function() {
        if (this.modelValue) await this.fetch();
        await this.listData();
        this.loading.main = false;
    },
    methods: {
        fetch: async function() {
            this.selected = await std(`/api/layer/${this.modelValue}`);
        },
        listData: async function() {
            this.loading.list = true;
            const url = stdurl('/api/layer');
            url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await std(url);

            this.loading.list = false;
        },
    }
};
</script>
