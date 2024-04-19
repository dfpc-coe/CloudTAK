<template>
<div class='col-12'>
    <div class='col-12 d-flex align-items-center'>
        <label v-text='label'></label>

        <div v-if='!disabled' class='ms-auto btn-list'>
            <IconPlus v-tooltip='"Add Link"' @click='create = true' size='20' class='cursor-pointer'/>
        </div>
    </div>

    <TablerNone v-if='!modelValue.length' :create='false' :compact='true' label='Link Overrides'/>
    <div v-else class='table-responsive'>
        <table class="table table-hover card-table table-vcenter" :class='{
            "cursor-pointer": !disabled
        }'>
            <thead>
                <tr>
                    <th>Link</th>
                </tr>
            </thead>
            <tbody>
                <tr @click='edit(link)' :key='link.name' v-for='(link, it) in modelValue'>
                    <td>
                        <div class='d-flex align-items-center'>
                            <span v-text='link.url'/>
                            <div class='ms-auto'>
                                <IconTrash v-if='!disabled' @click.stop='schema.splice(field_it, 1)' size='32' class='cursor-pointer'/>
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
    :edit='editField'
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
        label: {
            type: String,
            default: 'Link Override'
        }
    },
    data: function() {
        return {
            create: false,
            editField: {
                url: ''
            }
        }
    },
    methods: {
        push: function(field) {
            this.create = false;
            if (this.editField) {
                this.editField = Object.assign(this.editField, field);
            } else {
                this.schema.push(field);
            }
            this.editField = null;
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
