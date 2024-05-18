<template>
    <thead>
        <tr>
            <th
                v-for='h in shown'
                :key='h'
            >
                <div class='d-flex'>
                    <span
                        class='cursor-pointer'
                        @click='updateSort(h.name)'
                        v-text='h.name'
                    />
                    <span
                        v-if='h.name === sort'
                        class='ms-auto'
                    >
                        <IconChevronDown
                            v-if='order === "asc"'
                            size='16'
                            class='cursor-pointer'
                            @click='updateOrder("desc")'
                        />
                        <IconChevronUp
                            v-else
                            size='16'
                            class='cursor-pointer'
                            @click='updateOrder("asc")'
                        />
                    </span>

                    <template v-if='shown[shown.length - 1] === h'>
                        <div class='ms-auto'>
                            <div class='dropdown'>
                                <IconSettings
                                    size='16'
                                    class='mx-2 dropdown-toggle cursor-pointer'
                                    data-bs-toggle='dropdown'
                                />
                                <div class='dropdown-menu'>
                                    <div
                                        v-for='(h, h_it) of header'
                                        :key='h_it'
                                    >
                                        <label class='form-check subheader mb-0'>
                                            <input
                                                class='form-check-input'
                                                type='checkbox'
                                                :checked='h.display'
                                                @change='displayHeader(h_it, $event)'
                                            >
                                            <span
                                                class='form-check-label'
                                                v-text='h.name'
                                            />
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
    IconChevronUp,
    IconChevronDown,
    IconSettings
} from '@tabler/icons-vue';

export default {
    name: 'TableHeader',
    components: {
        IconSettings,
        IconChevronUp,
        IconChevronDown
    },
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
        order: function() {
            this.$emit('update:order', this.order);
        }
    },
    methods: {
        updateSort(sort) {
            this.$emit('update:sort', sort);
        },
        updateOrder: function(order) {
            this.$emit('update:order', order);
        },
        displayHeader: function(h_it, $event) {
            const header = JSON.parse(JSON.stringify(this.header));
            header[h_it].display = $event.target.checked;
            this.$emit('update:header', header);
        }
    }
}
</script>
