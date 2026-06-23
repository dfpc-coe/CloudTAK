<template>
    <div class='col-12'>
        <TablerLoading
            v-if='loading'
            desc='Updating Log'
        />
        <template v-else>
            <div
                class='mission-log-card cloudtak-bg bg-opacity-50 border rounded-3 text-white w-100 overflow-hidden'
                :class='{
                    "border-white border-opacity-10 shadow-sm": !editing && !!log.read,
                    "border-primary border-2 unread-pulse": !editing && !log.read,
                    "border-primary border-2 shadow": editing
                }'
                role='menuitem'
                tabindex='0'
            >
                <div class='d-flex align-items-center gap-2 px-2 pt-2'>
                    <div class='d-flex flex-column lh-sm overflow-hidden'>
                        <span
                            class='fw-semibold text-truncate'
                            v-text='log.creatorUid || "Unknown Author"'
                        />
                        <span
                            v-if='!editing'
                            class='text-white-50 small text-nowrap'
                            :class='{ "cursor-pointer": !log.read }'
                            @click='markAsRead'
                        >{{ formatDtg(log.dtg) }}</span>
                    </div>

                    <div class='ms-auto d-flex align-items-center gap-2'>
                        <template v-if='!editing'>
                            <span
                                v-if='!log.read'
                                class='unread-dot rounded-circle flex-shrink-0'
                                title='Unread'
                            />
                            <div
                                v-if='canWrite'
                                class='btn-list'
                            >
                                <TablerIconButton
                                    title='Edit Log'
                                    @click='startEditing'
                                >
                                    <IconPencil
                                        :size='20'
                                        stroke='1.5'
                                    />
                                </TablerIconButton>
                                <TablerDelete
                                    displaytype='icon'
                                    :size='20'
                                    @delete='deleteLog()'
                                />
                            </div>
                        </template>
                    </div>
                </div>

                <div class='px-2 pt-2 pb-2 d-flex flex-column gap-2'>
                    <template v-if='editing'>
                        <TablerInput
                            type='datetime-local'
                            label='Log Time'
                            :model-value='editDtg'
                            @update:model-value='editDtg = String($event)'
                        />

                        <TablerInput
                            v-model='editContent'
                            label=''
                            :rows='Math.max(4, editContent.split("\n").length)'
                            :autofocus='true'
                        />

                        <Keywords
                            v-model:keywords='editKeywords'
                            :relevant='relevant'
                        />

                        <div class='d-flex justify-content-end gap-2 mt-1'>
                            <TablerButton
                                class='btn-sm btn-secondary'
                                @click='cancelEditing'
                            >
                                Cancel
                            </TablerButton>
                            <TablerButton
                                class='btn-sm btn-primary'
                                @click='saveEditing'
                            >
                                Save
                            </TablerButton>
                        </div>
                    </template>
                    <template v-else>
                        <CopyField
                            class='w-100'
                            mode='text'
                            :rows='Math.max(2, (log.content || "").split("\n").length)'
                            :model-value='log.content || ""'
                        />

                        <Keywords :keywords='log.keywords' />
                    </template>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { DBSubscriptionLog } from '../../../../database.ts';
import Subscription from '../../../../base/subscription.ts';
import { db } from '../../../../database.ts';
import CopyField from '../../util/CopyField.vue';
import Keywords from '../../util/Keywords.vue';
import {
    TablerLoading,
    TablerButton,
    TablerDelete,
    TablerIconButton,
    TablerInput
} from '@tak-ps/vue-tabler';
import { IconPencil } from '@tabler/icons-vue';

const props = withDefaults(defineProps<{
    log: DBSubscriptionLog;
    subscription: Subscription;
    relevant?: string[];
}>(), {
    relevant: () => []
});

const loading = ref(false);

const editing = ref(false);
const editContent = ref('');
const editKeywords = ref<string[]>([]);
const editDtg = ref('');

const canWrite = computed(() => {
    return props.subscription.role.permissions.includes("MISSION_WRITE");
});

function toDatetimeLocal(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
}

function fromDatetimeLocal(local: string) {
    if (!local) return '';
    const d = new Date(local);
    return d.toISOString();
}

function formatDtg(dtg?: string) {
    if (!dtg) return 'No DTG';

    const parsed = new Date(dtg);

    if (Number.isNaN(parsed.getTime())) {
        return dtg;
    }

    return parsed.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

async function markAsRead() {
    if (!props.log.read) {
        await db.subscription_log.update(props.log.id, { read: true });
    }
}

function startEditing() {
    editContent.value = props.log.content || '';
    editKeywords.value = [...(props.log.keywords ?? [])];
    editDtg.value = toDatetimeLocal(props.log.dtg);
    editing.value = true;
}

function cancelEditing() {
    editing.value = false;
}

async function saveEditing() {
    const dtg = editDtg.value ? fromDatetimeLocal(editDtg.value) : (props.log.dtg ?? new Date().toISOString());

    await updateLog({
        content: editContent.value,
        keywords: editKeywords.value,
        dtg
    });

    editing.value = false;
}

async function updateLog(body: { content?: string; dtg?: string; keywords?: string[] }) {
    loading.value = true;
    try {
        await props.subscription.log.update(
            props.log.id,
            {
                content: body.content ?? props.log.content,
                dtg: body.dtg ?? props.log.dtg ?? new Date().toISOString(),
                keywords: body.keywords ?? props.log.keywords
            }
        );
    } finally {
        loading.value = false;
    }
}

async function deleteLog() {
    loading.value = true;
    try {
        await props.subscription.log.delete(props.log.id);
    } finally {
        loading.value = false;
    }
}
</script>

<style scoped>
.mission-log-card {
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.unread-dot {
    width: 8px;
    height: 8px;
    background-color: var(--tblr-primary, rgb(32, 107, 196));
    box-shadow: 0 0 0 0 rgba(32, 107, 196, 0.7);
    animation: pulse-blue 2s infinite;
}

.unread-pulse {
    animation: pulse-blue 2s infinite;
}

@keyframes pulse-blue {
    0% {
        box-shadow: 0 0 0 0 rgba(32, 107, 196, 0.7);
    }
    70% {
        box-shadow: 0 0 0 10px rgba(32, 107, 196, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(32, 107, 196, 0);
    }
}
</style>
