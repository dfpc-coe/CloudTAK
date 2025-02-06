<template>
    <div class='card-body'>
        <TablerLoading
            v-if='loading.main'
            :inline='true'
            desc='Loading Connections'
        />
        <template v-else-if='selected.id'>
            <div class='col-12 d-flex align-items-center'>
                <div v-text='selected.name' />
                <div class='ms-auto'>
                    <IconTrash
                        v-if='selected.id'
                        v-tooltip='"Remove Connection"'
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
                placeholder='Connection Filter...'
                class='pb-2'
            />

            <div
                v-if='loading.list'
                class='card-body'
            >
                <TablerLoading desc='Loading Connections' />
            </div>
            <TablerNone
                v-else-if='list.total === 0'
                :create='false'
                :compact='true'
                class='my-3'
                label='Connections'
            />
            <template
                v-for='item in list.items'
                v-else
            >
                <div
                    class='hover-dark px-2 py-2 cursor-pointer row rounded'
                    @click='selected = item'
                >
                    <div class='col-md-4'>
                        <span v-text='item.name' />
                    </div>

                    <div
                        class='col-md-8'
                        v-text='item.description'
                    />
                </div>
            </template>
        </template>
    </div>
    <div
        v-if='list.total > paging.limit && !selected.id'
        class='card-footer d-flex pt-3'
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
    name: 'ConnectionSelect',
    components: {
        IconTrash,
        TablerInput,
        TablerPager,
        TablerNone,
        TablerLoading
    },
    props: {
        modelValue: Object,
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
                if (this.selected.id) {
                    this.$emit('update:modelValue', this.selected);
                } else {
                    this.$emit('update:modelValue', {});
                }
            }
        },
        modelValue: async function() {
            if (this.modelValue && this.modelValue.id !== this.selected.id) {
                await this.fetch();
            }
        },
        paging: {
            deep: true,
            handler: async function() {
                await this.listData();
            },
        }
    },
    mounted: async function() {
        if (this.modelValue) {
            await this.fetch();
        }

        await this.listData();
        this.loading.main = false;
    },
    methods: {
        fetch: async function() {
            this.selected = await std(`/api/connection/${this.modelValue.id}`);
        },
        listData: async function() {
            this.loading.list = true;
            const url = stdurl('/api/connection');
            url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await std(url);

            this.loading.list = false;
        },
    }
};
</script>
