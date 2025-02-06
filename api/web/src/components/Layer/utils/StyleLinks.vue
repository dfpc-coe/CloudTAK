<template>
    <div class='col-12'>
        <div class='col-12 d-flex align-items-center'>
            <label v-text='label' />

            <div
                v-if='!disabled'
                class='ms-auto btn-list'
            >
                <IconPlus
                    v-tooltip='"Add Link"'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='create = true'
                />
            </div>
        </div>

        <TablerNone
            v-if='!links.length'
            :create='false'
            :compact='true'
            label='Link Overrides'
        />
        <div
            v-else
            class='table-responsive'
        >
            <table
                class='table card-table table-vcenter'
                :class='{
                    "cursor-pointer": !disabled
                }'
            >
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for='(link, it) in links'
                        :key='link.name'
                        @click='edit(link)'
                    >
                        <td v-text='link.remarks' />
                        <td>
                            <div class='d-flex align-items-center'>
                                <span v-text='link.url' />
                                <div class='ms-auto'>
                                    <IconTrash
                                        v-if='!disabled'
                                        :size='32'
                                        stroke='1'
                                        class='cursor-pointer'
                                        @click.stop='links.splice(it, 1)'
                                    />
                                </div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <StyleLinkModal
        v-if='create'
        :edit='editLink'
        :schema='schema'
        @done='push($event)'
        @close='create = false'
    />
</template>

<script>
import {
    TablerNone
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconTrash
} from '@tabler/icons-vue';
import StyleLinkModal from './StyleLinkModal.vue';

export default {
    name: 'StyleLinks',
    components: {
        IconPlus,
        IconTrash,
        TablerNone,
        StyleLinkModal,
    },
    props: {
        modelValue: {
            type: Array,
            required: true
        },
        disabled: {
            type: Boolean,
            default: true
        },
        schema: {
            type: Object,
            required: true
        },
        label: {
            type: String,
            default: 'Link Override'
        }
    },
    emits: [
        'update:modelValue'
    ],
    data: function() {
        return {
            create: false,
            editLink: false,
            links: this.modelValue
        }
    },
    watch: {
        modelValue: {
            deep: true,
            handler: function() {
                this.links = this.modelValue;
            }
        }
    },
    methods: {
        edit: function(link) {
            if (this.disabled) return;
            this.editLink = link;
            this.create = true;
        },
        push: function(link) {
            this.create = false;

            if (!this.editLink) {
                this.links.push(link);
            } else {
                this.editLink = Object.assign(this.editLink, link);
            }

            this.$emit('update:modelValue', this.links);

            this.editLink = null;
        },
    }
}
</script>
