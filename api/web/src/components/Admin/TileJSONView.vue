<template>
    <div class='col-12'>
        <label class='form-label'>Source Details</label>
        <div class='card'>
            <div class='card-body datagrid'>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>
                        Type
                    </div>
                    <div class='datagrid-content'>
                        {{ props.overlay.type }}
                    </div>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>
                        Format
                    </div>
                    <div class='datagrid-content'>
                        {{ props.overlay.format }}
                    </div>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>
                        Min Zoom
                    </div>
                    <div class='datagrid-content'>
                        {{ props.overlay.minzoom }}
                    </div>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>
                        Max Zoom
                    </div>
                    <div class='datagrid-content'>
                        {{ props.overlay.maxzoom }}
                    </div>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>
                        Bounds
                    </div>
                    <div class='datagrid-content'>
                        {{ props.overlay.bounds }}
                    </div>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>
                        Center
                    </div>
                    <div class='datagrid-content'>
                        {{ props.overlay.center }}
                    </div>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>
                        Tile URL
                    </div>
                    <div class='datagrid-content text-break'>
                        {{ tileUrl }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TileJSON } from '../../types.js';

const props = defineProps<{
    overlay: TileJSON & { url?: string };
}>();

const tileUrl = computed(() => {
    return props.overlay.tiles?.[0] || props.overlay.url || '';
});
</script>
