<template>
    <thead>
        <tr>
            <th
                v-for='s in shown'
                :key='s'
            >
                <div class='d-flex align-items-center'>
                    <span
                        class='cursor-pointer'
                        @click='updateSort(s.name)'
                        v-text='s.name'
                    />
                    <span
                        v-if='s.name === sort'
                        class='ms-auto'
                    >
                        <IconChevronDown
                            v-if='order === "asc"'
                            :size='16'
                            stroke='1'
                            class='cursor-pointer'
                            @click='updateOrder("desc")'
                        />
                        <IconChevronUp
                            v-else
                            :size='16'
                            stroke='1'
                            class='cursor-pointer'
                            @click='updateOrder("asc")'
                        />
                    </span>

                    <template v-if='shown[shown.length - 1] === s'>
                        <div class='ms-auto'>
                            <TablerDropdown>
                                <IconSettings
                                    :size='16'
                                    stroke='1'
                                    class='mx-2 dropdown-toggle cursor-pointer'
                                />

                                <template #dropdown>
                                    <div
                                        v-for='(h, h_it) of header'
                                        :key='h_it'
                                    >
                                        <label class='form-check subheader mb-1 mx-1'>
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
                                </template>
                            </TablerDropdown>
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
import {
    TablerDropdown
} from '@tak-ps/vue-tabler'

export default {
    name: 'TableHeader',
    components: {
        TablerDropdown,
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
    emits: [
        'update:order',
        'update:sort',
        'update:header'
    ],
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
