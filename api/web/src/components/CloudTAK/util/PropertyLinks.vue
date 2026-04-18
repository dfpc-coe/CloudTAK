<template>
    <div class='col-12'>
        <div class='col-12'>
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
                    <IconPlus
                        v-if='props.edit'
                        v-tooltip='"Add External Link"'
                        :size='20'
                        stroke='1'
                        class='cursor-pointer me-2'
                        @click.stop='addExternalLink'
                    />
                    <TablerBadge
                        class='me-2'
                        background-color='rgba(59, 130, 246, 0.15)'
                        border-color='rgba(59, 130, 246, 0.4)'
                        text-color='#3b82f6'
                    >
                        {{ external_links.length }}
                    </TablerBadge>
                </template>

                <div class='overflow-hidden mb-2'>
                    <div class='cloudtak-accent rounded mx-2 mt-2 px-2 py-2'>
                        <div
                            v-if='!external_links.length'
                            class='px-1 py-1 text-muted'
                        >
                            No external links
                        </div>

                        <div
                            v-for='item of external_links'
                            :key='item.index'
                            class='rounded border-0 bg-default mb-2 px-2 py-2'
                        >
                            <template v-if='isEditing(item.index)'>
                                <div class='d-flex align-items-center mb-2'>
                                    <div class='subheader user-select-none'>
                                        External Link
                                    </div>
                                    <div class='ms-auto d-flex align-items-center flex-nowrap'>
                                        <TablerIconButton
                                            title='Save Link'
                                            @click='saveExternalLink(item.index)'
                                        >
                                            <IconCheck
                                                :size='18'
                                                stroke='1'
                                            />
                                        </TablerIconButton>
                                        <TablerIconButton
                                            title='Remove Link'
                                            @click='removeExternalLink(item.index)'
                                        >
                                            <IconTrash
                                                :size='18'
                                                stroke='1'
                                            />
                                        </TablerIconButton>
                                    </div>
                                </div>

                                <TablerInput
                                    :model-value='draftLinks[item.index]?.remarks || ""'
                                    label='Label'
                                    placeholder='External Link'
                                    class='pb-2'
                                    @update:model-value='updateDraftLink(item.index, "remarks", String($event || ""))'
                                />

                                <TablerInput
                                    :model-value='draftLinks[item.index]?.url || ""'
                                    label='URL'
                                    placeholder='https://example.com'
                                    @update:model-value='updateDraftLink(item.index, "url", String($event || ""))'
                                />

                                <a
                                    v-if='draftLinks[item.index]?.url'
                                    :href='draftLinks[item.index]?.url'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    class='d-inline-flex align-items-center mt-2 small'
                                >
                                    <IconExternalLink
                                        :size='16'
                                        stroke='1'
                                        class='me-1'
                                    />
                                    <span class='text-truncate'>Open Link</span>
                                </a>
                            </template>

                            <div
                                v-else
                                class='d-flex align-items-center'
                            >
                                <a
                                    v-if='item.link.url'
                                    :href='item.link.url'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    class='d-flex align-items-center text-reset text-decoration-none flex-fill overflow-hidden'
                                >
                                    <IconExternalLink
                                        :size='18'
                                        stroke='1'
                                        class='me-2 flex-shrink-0'
                                    />
                                    <span class='text-truncate'>{{ item.link.remarks || item.link.url }}</span>
                                </a>
                                <div
                                    v-else
                                    class='text-muted flex-fill'
                                >
                                    Untitled Link
                                </div>

                                <TablerIconButton
                                    v-if='props.edit'
                                    title='Edit Link'
                                    @click='startEditing(item.index)'
                                >
                                    <IconPencil
                                        :size='18'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </div>

                        <div
                            v-if='isCreatingLink'
                            class='rounded border-0 bg-default mb-2 px-2 py-2'
                        >
                            <div class='d-flex align-items-center mb-2'>
                                <div class='subheader user-select-none'>
                                    External Link
                                </div>
                                <div class='ms-auto d-flex align-items-center flex-nowrap'>
                                    <TablerIconButton
                                        title='Save Link'
                                        @click='saveNewLink'
                                    >
                                        <IconCheck
                                            :size='18'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                    <TablerIconButton
                                        title='Discard Link'
                                        @click='cancelNewLink'
                                    >
                                        <IconTrash
                                            :size='18'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                </div>
                            </div>

                            <TablerInput
                                :model-value='newLink.remarks'
                                label='Label'
                                placeholder='External Link'
                                class='pb-2'
                                @update:model-value='newLink.remarks = String($event || "")'
                            />

                            <TablerInput
                                :model-value='newLink.url'
                                label='URL'
                                placeholder='https://example.com'
                                @update:model-value='newLink.url = String($event || "")'
                            />
                        </div>
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
                    <TablerBadge
                        class='me-2'
                        background-color='rgba(59, 130, 246, 0.15)'
                        border-color='rgba(59, 130, 246, 0.4)'
                        text-color='#3b82f6'
                    >
                        {{ responder_links.length }}
                    </TablerBadge>
                </template>

                <div class='overflow-hidden'>
                    <div class='row row-cards mx-2 pt-2'>
                        <div
                            v-for='(link, link_it) of responder_links'
                            :key='link_it'
                            class='col-12 mb-2'
                        >
                            <div class='card cloudtak-accent border-0'>
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
import { TablerBadge, TablerInput, TablerIconButton } from '@tak-ps/vue-tabler';
import { IconUsers, IconLink, IconExternalLink, IconPlus, IconTrash, IconPencil, IconCheck } from '@tabler/icons-vue';
import type COT from '../../../base/cot';
import timediff from '../../../timediff';

const expandedResponders = ref(false);
const expandedLinks = ref(false);
const editingIndex = ref<number | null>(null);
const isCreatingLink = ref(false);
const newLink = ref<LinkEntry>({
    remarks: '',
    url: ''
});
const draftLinks = ref<Record<number, LinkEntry>>({});

interface LinkEntry {
    remarks?: string;
    url?: string;
    relation?: string;
    type?: string;
    uid?: string;
    callsign?: string;
    production_time?: string;
}

const props = defineProps<{
    cot: COT;
    edit?: boolean;
}>();

const links = computed<LinkEntry[]>(() => {
    return (props.cot.properties.links || []) as LinkEntry[];
});

const external_links = computed(() => {
    return links.value
        .map((link, index) => ({ link, index }))
        .filter((item) => item.link.relation !== 't-s');
});

const responder_links = computed(() => {
    return links.value.filter((link) => {
        return link.relation === 't-s';
    });
});

function updateLinks(nextLinks: LinkEntry[]): void {
    const properties = {
        ...props.cot.properties,
        links: nextLinks
    };

    props.cot.update({ properties });
}

function addExternalLink(): void {
    isCreatingLink.value = true;
    editingIndex.value = null;
    newLink.value = {
        remarks: '',
        url: ''
    };
    expandedLinks.value = true;
}

function removeExternalLink(index: number): void {
    if (editingIndex.value === index) {
        editingIndex.value = null;
        delete draftLinks.value[index];
    }

    updateLinks(links.value.filter((_, itemIndex) => itemIndex !== index));
}

function startEditing(index: number): void {
    editingIndex.value = index;
    isCreatingLink.value = false;
    draftLinks.value[index] = {
        ...links.value[index]
    };
    expandedLinks.value = true;
}

function isEditing(index: number): boolean {
    return editingIndex.value === index;
}

function updateDraftLink(index: number, key: 'remarks' | 'url', value: string): void {
    draftLinks.value[index] = {
        ...(draftLinks.value[index] || links.value[index] || {}),
        [key]: value
    };
}

function saveExternalLink(index: number): void {
    const nextLinks = links.value.map((link, itemIndex) => {
        if (itemIndex !== index) return link;

        return {
            ...link,
            ...(draftLinks.value[index] || {})
        };
    });

    updateLinks(nextLinks);
    editingIndex.value = null;
    delete draftLinks.value[index];
}

function saveNewLink(): void {
    updateLinks([
        ...links.value,
        {
            ...newLink.value
        }
    ]);

    isCreatingLink.value = false;
    newLink.value = {
        remarks: '',
        url: ''
    };
}

function cancelNewLink(): void {
    isCreatingLink.value = false;
    newLink.value = {
        remarks: '',
        url: ''
    };
    expandedLinks.value = true;
}
</script>

<style scoped>


.list-group-item-action:hover {
    background-color: rgba(255, 255, 255, 0.05) !important;
}
</style>
