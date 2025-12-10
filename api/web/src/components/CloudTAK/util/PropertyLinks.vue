<template>
    <div
        v-if='url_links.length || responder_links.length'
        class='col-12 py-2'
    >
        <div
            v-if='url_links.length'
            class='col-12 mb-3'
        >
            <div class='col-12 mb-2'>
                <IconLink
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
                <label class='subheader user-select-none'>Links</label>
            </div>
            <div class='list-group list-group-flush bg-accent rounded mx-2'>
                <a
                    v-for='(link, link_it) of url_links'
                    :key='link_it'
                    :href='link.url'
                    target='_blank'
                    class='list-group-item list-group-item-action d-flex align-items-center bg-transparent border-0'
                >
                    <span class='text-truncate'>{{ link.remarks || link.url }}</span>
                </a>
            </div>
        </div>

        <div
            v-if='responder_links.length'
            class='col-12'
        >
            <div
                class='d-flex align-items-center cursor-pointer user-select-none py-2 px-2 rounded transition-all mx-2'
                :class='{ "bg-accent": expanded, "hover": !expanded }'
                @click='expanded = !expanded'
            >
                <IconUsers
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
                <label class='subheader cursor-pointer m-0'>Tasked Personnel</label>
                <div class='ms-auto d-flex align-items-center'>
                    <span class='badge bg-blue-lt me-2'>{{ responder_links.length }}</span>
                    <IconChevronDown
                        class='transition-transform'
                        :class='{ "rotate-180": !expanded }'
                        :size='18'
                    />
                </div>
            </div>

            <div
                class='grid-transition'
                :class='{ expanded: expanded }'
            >
                <div class='overflow-hidden'>
                    <div class='row row-cards mx-2 pt-2'>
                        <div
                            v-for='(link, link_it) of responder_links'
                            :key='link_it'
                            class='col-12 mb-2'
                        >
                            <div class='card bg-accent border-0'>
                                <div class='card-body p-2'>
                                    <div class='d-flex align-items-center'>
                                        <span class='avatar me-2 rounded-circle bg-blue-lt'>
                                            {{ (link.callsign || link.uid || '?').substring(0, 2).toUpperCase() }}
                                        </span>
                                        <div class='flex-fill overflow-hidden'>
                                            <div class='d-flex justify-content-between align-items-center'>
                                                <h4
                                                    class='m-0 text-truncate'
                                                    :title='link.callsign || link.uid'
                                                >
                                                    {{ link.callsign || link.uid }}
                                                </h4>
                                                <small class='text-muted ms-2 text-nowrap'>{{ link.production_time ? timediff(link.production_time) : "" }}</small>
                                            </div>
                                            <div
                                                class='text-muted small mt-1 text-truncate'
                                                :title='link.remarks'
                                            >
                                                {{ link.remarks }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import { IconUsers, IconLink, IconChevronDown } from '@tabler/icons-vue';
import timediff from '../../../timediff';

const expanded = ref(false);

const props = defineProps<{
    links: Array<{
        remarks?: string;
        url?: string;
        relation?: string;
        type?: string;
        uid?: string;
        callsign?: string;
        production_time?: string;
    }>
}>();

const url_links = computed(() => {
    return props.links.filter((link) => {
        return link.url;
    });
});

const responder_links = computed(() => {
    return props.links.filter((link) => {
        return link.relation === 't-s';
    });
});
</script>

<style scoped>
.grid-transition {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease-out;
}

.grid-transition.expanded {
    grid-template-rows: 1fr;
}

.rotate-180 {
    transform: rotate(-90deg);
}

.transition-transform {
    transition: transform 0.3s ease-out;
}
</style>
