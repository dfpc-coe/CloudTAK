<template>
    <div class='col-12'>
        <TablerLoading
            v-if='loading'
            desc='Updating Log'
        />
        <template v-else>
            <div
                class='card bg-dark bg-opacity-50 border border-white border-opacity-25 rounded text-white w-100 p-2 d-flex gap-3 align-items-start flex-row shadow-sm'
                role='menuitem'
                tabindex='0'
            >
                <div class='d-flex flex-column w-100'>
                    <div class='d-flex align-items-center flex-wrap w-100 gap-2'>
                        <div class='fw-semibold'>
                            {{ log.creatorUid || 'Unknown Author' }}
                        </div>
                        <TablerDropdown
                            v-if='canWrite'
                            class='ms-auto'
                        >
                            <template #default>
                                <span class='text-white-50 small text-nowrap cursor-pointer'>{{ formatDtg(log.dtg) }}</span>
                            </template>
                            <template #dropdown>
                                <div
                                    class='p-2'
                                    style='min-width: 300px;'
                                >
                                    <TablerInput
                                        label='Log Time'
                                        type='datetime-local'
                                        :model-value='dtgEdit ?? toDatetimeLocal(log.dtg)'
                                        @update:model-value='dtgEdit = $event'
                                    />
                                    <div class='d-flex justify-content-end gap-2 mt-2'>
                                        <button
                                            class='btn btn-sm btn-secondary'
                                            @click='cancelEdit'
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            class='btn btn-sm btn-primary'
                                            @click='saveDtg'
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>
                            </template>
                        </TablerDropdown>
                        <span
                            v-else
                            class='text-white-50 small text-nowrap'
                        >{{ formatDtg(log.dtg) }}</span>
                    </div>
                    <CopyField
                        class='w-100'
                        mode='text'
                        :edit='canWrite'
                        :deletable='canWrite'
                        :hover='canWrite'
                        :rows='Math.max(4, log.content.split("\n").length)'
                        :model-value='log.content || ""'
                        @submit='updateLog({ content: $event })'
                        @delete='deleteLog()'
                    />

                    <Keywords :keywords='log.keywords' />
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { MissionLog } from '../../../../types.ts';
import Subscription from '../../../../base/subscription.ts';
import CopyField from '../../util/CopyField.vue';
import Keywords from '../../util/Keywords.vue';
import {
    TablerLoading,
    TablerDropdown,
    TablerInput
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    log: MissionLog;
    subscription: Subscription;
}>();

const loading = ref(false);
const dtgEdit = ref<string | null>(null);

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

function cancelEdit() {
    dtgEdit.value = null;
    document.body.click();
}

async function saveDtg() {
    if (dtgEdit.value) {
        const iso = fromDatetimeLocal(dtgEdit.value);
        if (iso !== props.log.dtg) {
            await updateLog({ dtg: iso });
        }
    }

    cancelEdit();
}

async function updateLog(body: { content?: string; dtg?: string; keywords?: string[] }) {
    loading.value = true;
    try {
        await props.subscription.log.update(
            props.log.id,
            {
                content: body.content ?? props.log.content,
                dtg: body.dtg ?? props.log.dtg,
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
