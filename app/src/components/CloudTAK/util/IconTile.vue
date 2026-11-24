<template>
    <button
        type='button'
        class='icon-tile'
        :title='icon.path'
    >
        <span class='icon-tile-well'>
            <img
                :src='src'
                :alt='icon.path'
                width='24'
                height='24'
                draggable='false'
            >
        </span>
        <span
            class='icon-tile-label'
            v-text='IconCache.leaf(icon.path)'
        />
    </button>
</template>

<script setup lang="ts">
import IconCache from '../../../base/icon.ts';
import type { DBIcon } from '../../../database.ts';

defineProps<{
    icon: DBIcon;
    src: string;
}>();
</script>

<style scoped>
.icon-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 10px 4px 8px;
    color: inherit;
    font: inherit;
    background: var(--cloudtak-hover-bg);
    border: 1px solid var(--tblr-border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s ease;
}

.icon-tile:hover {
    border-color: var(--cloudtak-hover-border);
}

.icon-tile:focus-visible {
    border-color: var(--tblr-primary);
    outline: none;
}

.icon-tile-label {
    max-width: 100%;
    font-size: 0.75rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Icons are drawn for the dark map, so the well stays dark in both themes */
.icon-tile-well {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    overflow: hidden;
    background: rgb(30, 41, 59);
    border: 1px solid var(--tblr-border-color);
    border-radius: 6px;
}

.icon-tile-well img {
    width: 24px;
    height: 24px;
    object-fit: contain;
}
</style>
