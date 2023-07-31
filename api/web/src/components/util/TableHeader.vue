<template>
<thead>
    <tr>
        <th :key='h' v-for='h in shown'>
            <div class='d-flex'>
                <span @click='sort = h.name' v-text='h.name' class='cursor-pointer'/>
                <span v-if='h.name === sort' class='ms-auto'>
                    <ChevronDownIcon height='16' @click='order = "desc"' v-if='order === "asc"' class='cursor-pointer'/>
                    <ChevronUpIcon height='16' @click='order = "asc"' v-else class='cursor-pointer'/>
                </span>

                <template v-if='shown[shown.length - 1] === h'>
                    <div class='ms-auto'>
                        <div class="dropdown">
                            <SettingsIcon height='16' width='16' class='mx-2 dropdown-toggle cursor-pointer' data-bs-toggle="dropdown"/>
                            <div class="dropdown-menu">
                                <div :key='h_it' v-for='(h, h_it) of header'>
                                    <label class='form-check subheader mb-0'>
                                        <input @change='displayHeader(h_it, $event)' class='form-check-input' type="checkbox" :checked='h.display'>
                                        <span class='form-check-label' v-text='h.name'></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </th>
    </tr>
</thead>
</template>

<script>
import {
    ChevronUpIcon,
    ChevronDownIcon,
    SettingsIcon
} from 'vue-tabler-icons';

export default {
    name: 'TableHeader',
    props: {
        header: {
            type: Array,
            required: true,
            description: 'Array of object headers - [{ name: "example", "displayed: true }]'
        },
        order: {
            type: String,
            required: false,
            default: 'desc',
            description: 'Order to sort by asc or desc'
        },
        sort: {
            type: String,
            required: false,
            description: 'Field to sort by'
        },
    },
    computed: {
        shown: function() {
           return this.header.filter((h) => {
                return h.display;
           });
        }
    },
    watch: {
        sort: function() {
            this.$emit('update:sort', this.sort);
        },
        order: function() {
            this.$emit('update:order', this.order);
        }
    },
    methods: {
        displayHeader: function(h_it, $event) {
            const header = JSON.parse(JSON.stringify(this.header));
            header[h_it].display = $event.target.checked;
            this.$emit('update:header', header);
        }
    },
    components: {
        SettingsIcon,
        ChevronUpIcon,
        ChevronDownIcon
    }
}
</script>
