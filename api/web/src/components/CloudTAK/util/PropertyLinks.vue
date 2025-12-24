<template>
    <div
        v-if='url_links.length || responder_links.length'
        class='col-12'
    >
        <div
            v-if='url_links.length'
            class='col-12'
        >
            <SlideDownHeader
                v-model='expandedLinks'
                label='Links'
            >
                <template #icon>
                    <IconLink
                        :size='18'
                        stroke='1'
                        color='#6b7990'
                        class='ms-2 me-1'
                    />
                </template>
                <template #right>
                    <span class='badge bg-blue-lt me-2'>{{ url_links.length }}</span>
                </template>

                <div class='overflow-hidden mb-2'>
                    <div class='list-group list-group-flush bg-accent rounded mx-2 mt-2'>
                        <a
                            v-for='(link, link_it) of url_links'
                            :key='link_it'
                            :href='link.url'
                            target='_blank'
                            class='list-group-item list-group-item-action d-flex align-items-center bg-transparent border-0'
                        >
                            <IconExternalLink
                                :size='18'
                                stroke='1'
                                class='me-2'
                            />
                            <span class='text-truncate'>{{ link.remarks || link.url }}</span>
                        </a>
                    </div>
                </div>
            </SlideDownHeader>
        </div>

        <div
            v-if='responder_links.length'
            class='col-12'
        >
            <SlideDownHeader
                v-model='expandedResponders'
                label='Tasked Personnel'
            >
                <template #icon>
                    <IconUsers
                        :size='18'
                        stroke='1'
                        color='#6b7990'
                        class='ms-2 me-1'
                    />
                </template>
                <template #right>
                    <span class='badge bg-blue-lt me-2'>{{ responder_links.length }}</span>
                </template>

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
            </SlideDownHeader>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import SlideDownHeader from './SlideDownHeader.vue';
import { IconUsers, IconLink, IconExternalLink } from '@tabler/icons-vue';
import timediff from '../../../timediff';

const expandedResponders = ref(false);
const expandedLinks = ref(false);

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


.list-group-item-action:hover {
    background-color: rgba(255, 255, 255, 0.05) !important;
}
</style>
