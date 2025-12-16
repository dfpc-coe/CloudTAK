<template>
    <component
        :is='compact ? &apos;div&apos; : StandardItem'
        :class='classes'
        role='menuitem'
        tabindex='0'
        @click='$emit("select")'
        @keyup.enter='$emit("select")'
    >
        <div class='menu-item-card__icon-wrapper'>
            <component
                :is='icon'
                v-if='icon'
                v-tooltip='tooltipBinding'
                :title='tooltip'
                :size='iconSize'
                :color='iconColor'
                stroke='1'
                class='menu-item-card__icon'
            />
            <span
                v-if='layout === "tiles" && badge'
                class='menu-item-card__badge menu-item-card__badge--tile-icon'
            >{{ badge }}</span>
        </div>

        <span
            v-if='compact && badge'
            class='menu-item-card__badge menu-item-card__badge--compact'
        >{{ badge }}</span>

        <template v-if='!compact'>
            <template v-if='layout === "tiles"'>
                <div class='menu-item-card__body menu-item-card__body--tile'>
                    <div class='menu-item-card__label'>
                        {{ label }}
                    </div>
                    <div
                        v-if='description'
                        class='menu-item-card__description'
                        :class='descriptionClass'
                    >
                        {{ description }}
                    </div>
                </div>
            </template>
            <template v-else-if='compact'>
                <span class='menu-item-card__label menu-item-card__label--compact'>{{ label }}</span>
            </template>
            <template v-else>
                <div class='menu-item-card__body'>
                    <div class='menu-item-card__label'>
                        {{ label }}
                    </div>
                    <div
                        v-if='description'
                        class='menu-item-card__description'
                        :class='descriptionClass'
                    >
                        {{ description }}
                    </div>
                </div>
                <span
                    v-if='badge'
                    class='menu-item-card__badge menu-item-card__badge--admin ms-auto'
                >{{ badge }}</span>
                <div
                    v-if='$slots.default'
                    class='ms-auto'
                >
                    <slot />
                </div>
            </template>
        </template>
    </component>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import type { Component, PropType } from 'vue';
import StandardItem from '../util/StandardItem.vue';

defineEmits(['select']);

type LayoutVariant = 'list' | 'tiles';

const props = defineProps({
    icon: {
        type: Function as unknown as PropType<Component>,
        required: true
    },
    iconColor: {
        type: String,
        default: undefined
    },
    label: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    descriptionClass: {
        type: String,
        default: ''
    },
    tooltip: {
        type: String,
        default: ''
    },
    badge: {
        type: String,
        default: ''
    },
    layout: {
        type: String as PropType<LayoutVariant>,
        default: 'list'
    },
    compact: {
        type: Boolean,
        default: false
    }
});

const classes = computed(() => ({
    'menu-item-card': true,
    [`menu-item-card--${props.layout}`]: true,
    'menu-item-card--compact position-relative hover-button': props.compact,
}));

const iconSize = computed(() => props.layout === 'tiles' ? 36 : 32);
const tooltipBinding = computed(() => props.tooltip ? { content: props.tooltip, placement: 'left' } : undefined);
</script>

<style scoped>
.menu-item-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #fff;
    cursor: pointer;
    user-select: none;
}

.menu-item-card--list:not(.menu-item-card--compact) {
    padding: 0.85rem 1rem;
}

.menu-item-card--tiles {
    flex-direction: column;
    text-align: center;
    padding: 1rem;
}

.menu-item-card--compact {
    padding: 0.5rem 0.75rem;
}

.menu-item-card__icon-wrapper {
    position: relative;
    display: flex;
    flex-shrink: 0;
}

.menu-item-card__badge--tile-icon {
    position: absolute;
    top: -4px;
    right: -6px;
    min-width: 16px;
    height: 16px;
    border-radius: 999px;
    font-size: 10px;
    background: #228be6;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.menu-item-card__icon {
    flex-shrink: 0;
}

.menu-item-card__body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.menu-item-card__body--tile {
    align-items: center;
}

.menu-item-card__label {
    font-size: 1rem;
    font-weight: 600;
}

.menu-item-card__label--compact {
    font-size: 0.95rem;
}

.menu-item-card__description {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.78);
}

.menu-item-card__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
}



.menu-item-card__badge--admin {
    border: 1px solid rgba(99, 137, 255, 0.9);
    background-color: rgba(99, 137, 255, 0.25);
    color: #fff;
}

.menu-item-card__badge--compact {
    position: absolute;
    top: 5px;
    right: 5px;
    min-width: 14px;
    height: 14px;
    border-radius: 14px;
    font-size: 10px;
    background: #228be6;
    color: white;
    padding: 0 3px;
}
</style>
