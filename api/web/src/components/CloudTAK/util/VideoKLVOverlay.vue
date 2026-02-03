<template>
    <div
        class='klv-overlay'
        :class='{ "klv-overlay--expanded": expanded }'
    >
        <div
            v-if='!expanded'
            class='klv-badge'
            title='Show KLV Metadata'
            @click='expanded = true'
        >
            KLV
        </div>
        <div
            v-else
            class='klv-panel'
        >
            <div class='klv-panel-header d-flex align-items-center px-2 py-1'>
                <span class='klv-panel-title'>KLV Metadata</span>
                <span
                    v-if='timestamp'
                    class='klv-timestamp ms-2'
                    v-text='timestamp'
                />
                <button
                    class='klv-close ms-auto btn btn-sm'
                    title='Collapse'
                    @click='expanded = false'
                >
                    <IconX
                        :size='14'
                        stroke='1'
                    />
                </button>
            </div>
            <div class='klv-panel-body'>
                <table class='klv-table'>
                    <tr
                        v-for='field in sortedFields'
                        :key='field.tag'
                    >
                        <td
                            class='klv-key'
                            v-text='field.name'
                        />
                        <td class='klv-val'>
                            <span v-text='field.value' />
                            <span
                                v-if='field.unit'
                                class='klv-unit'
                                v-text='field.unit'
                            />
                        </td>
                    </tr>
                </table>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { IconX } from '@tabler/icons-vue';
import type { KLVField } from '../../../lib/klv.ts';

const props = defineProps<{
    metadata: Map<number, KLVField>;
}>();

const expanded = ref(false);

const sortedFields = computed(() => {
    return Array.from(props.metadata.values()).sort((a, b) => a.tag - b.tag);
});

const timestamp = computed(() => {
    const ts = props.metadata.get(2);
    if (!ts || typeof ts.value !== 'string') return '';
    try {
        const d = new Date(ts.value);
        return d.toLocaleTimeString();
    } catch {
        return '';
    }
});
</script>

<style scoped>
.klv-overlay {
    position: absolute;
    bottom: 40px;
    right: 8px;
    z-index: 10;
    pointer-events: auto;
}

.klv-badge {
    background: rgba(0, 0, 0, 0.6);
    color: #ffffffcc;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    border: 1px solid rgba(255, 255, 255, 0.18);
    transition: background 0.15s ease;
}

.klv-badge:hover {
    background: rgba(0, 0, 0, 0.8);
    border-color: rgba(255, 255, 255, 0.4);
}

.klv-panel {
    width: 280px;
    max-height: 300px;
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    color: #ffffffdd;
    font-size: 11px;
    backdrop-filter: blur(6px);
}

.klv-panel-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
}

.klv-panel-title {
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.3px;
}

.klv-timestamp {
    font-size: 10px;
    color: #ffffff88;
}

.klv-close {
    padding: 0;
    line-height: 1;
    color: #ffffffaa;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
}

.klv-close:hover {
    color: #ffffff;
}

.klv-panel-body {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
}

.klv-table {
    width: 100%;
    border-collapse: collapse;
}

.klv-table tr:hover {
    background: rgba(255, 255, 255, 0.05);
}

.klv-table td {
    padding: 2px 8px;
    vertical-align: top;
    white-space: nowrap;
}

.klv-key {
    color: #ffffff88;
    font-size: 10px;
    width: 45%;
}

.klv-val {
    color: #ffffffdd;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
}

.klv-unit {
    color: #ffffff66;
    font-size: 9px;
    margin-left: 2px;
}
</style>
