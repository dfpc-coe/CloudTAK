<template>
<div class='col-12'>
    <div class='col-12 d-flex align-items-center'>
        <label v-text='label'></label>

        <div v-if='!disabled' class='ms-auto btn-list'>
            <IconPlus v-tooltip='"Add Link"' @click='create = true' size='20' class='cursor-pointer'/>
        </div>
    </div>

    <TablerNone v-if='!links.length' :create='false' :compact='true' label='Link Overrides'/>
    <div v-else class='table-responsive'>
        <table class="table card-table table-vcenter" :class='{
            "cursor-pointer": !disabled
        }'>
            <thead>
                <tr>
                    <th>Link</th>
                </tr>
            </thead>
            <tbody>
                <tr @click='edit(link)' :key='link.name' v-for='(link, it) in links'>
                    <td>
                        <div class='d-flex align-items-center'>
                            <span v-text='link.url'/>
                            <div class='ms-auto'>
                                <IconTrash v-if='!disabled' @click.stop='links.splice(it, 1)' size='32' class='cursor-pointer'/>
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
    watch: {
        modelValue: {
            deep: true,
            handler: function() {
                this.links = this.modelValue;
            }
        }
    },
    data: function() {
        return {
            create: false,
            editLink: false,
            links: this.modelValue
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
    },
    components: {
        IconPlus,
        IconTrash,
        TablerNone,
        StyleLinkModal,
    }
}
</script>
