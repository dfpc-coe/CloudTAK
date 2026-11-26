<template>
    <div class='d-flex align-items-center'>
        <img
            v-if='plugin.logo'
            :src='plugin.logo'
            :alt='`${plugin.name} logo`'
            width='32'
            height='32'
            style='object-fit: contain;'
        >
        <IconPuzzle
            v-else
            :size='32'
            stroke='1'
        />
        <div
            class='ms-2 flex-grow-1'
            style='min-width: 0;'
        >
            <div class='d-flex align-items-center'>
                <div
                    class='font-weight-bold text-truncate'
                    v-text='plugin.name'
                />
                <div class='ms-auto d-flex align-items-center gap-2'>
                    <slot />
                </div>
            </div>
            <div
                v-if='plugin.author'
                class='subheader text-truncate'
                v-text='`by ${plugin.author}`'
            />
            <div
                v-if='plugin.description'
                class='subheader text-wrap'
                v-text='plugin.description'
            />
            <div
                v-if='plugin.license || plugin.homepage'
                class='subheader d-flex align-items-center gap-2'
            >
                <span
                    v-if='plugin.license'
                    v-text='plugin.license'
                />
                <a
                    v-if='plugin.homepage'
                    :href='plugin.homepage'
                    target='_blank'
                    rel='noopener noreferrer'
                    @click.stop
                >Homepage</a>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import type { Plugin } from '../../types.ts';
import { IconPuzzle } from '@tabler/icons-vue';

defineProps<{
    plugin: Plugin
}>();
</script>
