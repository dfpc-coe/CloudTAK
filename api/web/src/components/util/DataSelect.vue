<template>
    <div class='w-100'>
        <TablerLoading
            v-if='loading'
            :inline='true'
        />
        <template v-else>
            <div class='d-flex align-items-center mx-2'>
                <template v-if='selected.id'>
                    <span
                        class='cursor-pointer'
                        @click='$router.push(`/connection/${selected.connection}/data/${selected.id}`)'
                        v-text='selected.name'
                    />
                </template>
                <template v-else>
                    <span>No Data Sync Selected - Data will output as CoTs directly to the Connection</span>
                </template>

                <div
                    v-if='!disabled'
                    class='btn-list ms-auto'
                >
                    <IconTrash
                        v-if='selected.id'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='update'
                    />
                    <TablerDropdown>
                        <template #default>
                            <IconSettings
                                :size='32'
                                stroke='1'
                                class='cursor-pointer dropdown-toggle'
                            />
                        </template>
                        <template #dropdown>
                            <div class='table-resposive'>
                                <table class='table table-hover'>
                                    <thead>
                                        <tr>
                                            <th>(Status) Name</th>
                                        </tr>
                                    </thead>
                                    <tbody class='table-tbody'>
                                        <tr
                                            v-for='d of data.items'
                                            :key='d.id'
                                            class='cursor-pointer'
                                            @click='update(d)'
                                        >
                                            <td>
                                                <div class='d-flex align-items-center'>
                                                    <span
                                                        class='mt-2'
                                                        v-text='d.name'
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </template>
                    </TablerDropdown>
                </div>
            </div>
        </template>
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    IconTrash,
    IconSettings
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerDropdown
} from '@tak-ps/vue-tabler';

export default {
    name: 'DataSelect',
    components: {
        IconTrash,
        IconSettings,
        TablerLoading,
        TablerDropdown
    },
    props: {
        connection: Number,
        modelValue: Number,
        disabled: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue'],
    data: function() {
        return {
            loading: true,
            selected: {
                id: '',
                name: ''
            },
            data: {
                total: 0,
                items: []
            }
        }
    },
    watch: {
        'selected.id': function() {
            if (this.selected.id) {
                this.$emit('update:modelValue', this.selected.id);
            } else {
                this.$emit('update:modelValue', null);
            }
        },
        modelValue: function() {
            if (this.modelValue) this.fetch();
        }
    },
    mounted: async function() {
        if (this.modelValue) await this.fetch();
        await this.listData();
        this.loading = false;
    },
    methods: {
        update: function(data) {
            if (data) {
                this.selected.id = data.id;
                this.selected.name = data.name;
            } else {
                this.selected.id = '';
                this.selected.name = '';
            }
        },
        fetch: async function() {
            this.selected = await std(`/api/connection/${this.connection}/data/${this.modelValue}`);
        },
        listData: async function() {
            this.data = await std(`/api/connection/${this.connection}/data`);
        },
    },
};
</script>
