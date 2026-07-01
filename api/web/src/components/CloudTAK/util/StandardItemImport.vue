<template>
    <StandardItem @click='$emit("click")'>
        <div class='d-flex align-items-center gap-2 px-3 py-2'>
            <StatusDot
                :dark='true'
                :status='imp.status'
            />

            <div
                v-tooltip='`${imp.source} Import`'
                class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 flex-shrink-0'
                style='width: 36px; height: 36px;'
            >
                <IconAmbulance
                    v-if='imp.source === "Mission"'
                    :size='20'
                    stroke='1'
                />
                <IconPackages
                    v-else-if='imp.source === "Package"'
                    :size='20'
                    stroke='1'
                />
                <IconFile
                    v-else
                    :size='20'
                    stroke='1'
                />
            </div>

            <div class='flex-grow-1 overflow-hidden'>
                <div
                    class='fw-semibold text-truncate'
                    v-text='imp.name'
                />
                <div class='text-muted small d-flex gap-2'>
                    <span
                        v-if='showUsername'
                        class='text-truncate'
                        v-text='imp.username'
                    />
                    <span v-text='timeDiff(imp.created)' />
                </div>
            </div>

            <div
                v-if='buttonRetry || buttonDownload'
                class='d-flex align-items-center gap-1 flex-shrink-0'
                @click.stop
            >
                <TablerIconButton
                    v-if='buttonRetry && imp.status === "Fail"'
                    title='Retry Import'
                    @click='$emit("retry")'
                >
                    <IconRestore
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    v-if='buttonDownload'
                    title='Download File'
                    @click='$emit("download")'
                >
                    <IconDownload
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
    </StandardItem>
</template>

<script setup lang='ts'>
import StandardItem from './StandardItem.vue';
import StatusDot from '../../util/StatusDot.vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import {
    IconFile,
    IconAmbulance,
    IconPackages,
    IconRestore,
    IconDownload,
} from '@tabler/icons-vue';
import type { Import } from '../../../types.ts';
import timeDiff from '../../../timediff.ts';

withDefaults(defineProps<{
    imp: Import;
    showUsername?: boolean;
    buttonRetry?: boolean;
    buttonDownload?: boolean;
}>(), {
    showUsername: false,
    buttonRetry: false,
    buttonDownload: false,
});

defineEmits<{
    (e: 'click'): void;
    (e: 'retry'): void;
    (e: 'download'): void;
}>();
</script>
