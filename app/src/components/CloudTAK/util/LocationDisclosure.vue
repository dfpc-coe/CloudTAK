<template>
    <div class='modal-status bg-blue' />
    <div class='modal-header'>
        <div class='d-flex align-items-center'>
            <IconCurrentLocation
                v-if='stage === "background"'
                :size='28'
                stroke='1'
            />
            <IconMapPin
                v-else
                :size='28'
                stroke='1'
            />
            <span class='mx-2'>{{ title }}</span>
        </div>
    </div>
    <div class='modal-body'>
        <p>{{ lead }}</p>

        <div class='card mb-3'>
            <ul class='card-body list-unstyled d-flex flex-column gap-2 mb-0'>
                <li>Your location is sent to the TAK server you are connected to and shared with members of your team.</li>
                <li>The server's administrator controls whether location data is stored and for how long.</li>
                <li v-if='stage === "background" && android'>
                    A persistent notification is shown whenever CloudTAK is sharing your location in the background.
                </li>
                <li>CloudTAK does not use your location for advertising.</li>
            </ul>
        </div>

        <p class='text-secondary mb-0'>
            {{ next }}
        </p>
    </div>
    <div class='modal-footer'>
        <button
            class='btn btn-link text-secondary px-0'
            :disabled='working'
            @click='emit("decline")'
        >
            Not now
        </button>
        <div class='ms-auto'>
            <button
                class='btn btn-primary'
                :disabled='working'
                @click='emit("accept")'
            >
                {{ working ? 'Requesting...' : 'Agree and continue' }}
            </button>
        </div>
    </div>
</template>

<script lang='ts'>
export type LocationDisclosureStage = 'location' | 'background';
</script>

<script setup lang='ts'>
import { computed } from 'vue';
import type { PropType } from 'vue';
import { IconCurrentLocation, IconMapPin } from '@tabler/icons-vue';
import { isNativePlatform, isAndroidPlatform, isIOSPlatform } from '../../../utils/capacitor.ts';

const props = defineProps({
    stage: {
        type: String as PropType<LocationDisclosureStage>,
        default: 'location'
    },
    // The next step opens device settings instead of a system prompt
    settings: {
        type: Boolean,
        default: false
    },
    working: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['accept', 'decline']);

const android = isAndroidPlatform();
const always = android ? '"Allow all the time"' : '"Always"';

const title = computed(() => {
    return props.stage === 'background' ? 'Background location' : 'Location access';
});

const lead = computed(() => {
    if (props.stage === 'background') {
        return 'CloudTAK shares your location with your team even when the app is closed or not in use, so your position stays current on the map while you are not looking at it.';
    }

    return isNativePlatform()
        ? "CloudTAK collects your device's location, including when the app is closed or not in use, so your team can see your position on the map."
        : "CloudTAK collects your device's location while it is open in your browser so your team can see your position on the map.";
});

const next = computed(() => {
    if (props.stage === 'background') {
        if (props.settings) {
            return `Next, CloudTAK will open your device settings. Set Location to ${always} to keep sharing your position in the background.`;
        } else if (android) {
            return 'Next, Android will ask for background location access. Choose "Allow all the time" to keep sharing your position in the background. You can change this anytime in Settings.';
        }

        return 'Next, iOS will ask to change location access to "Always". Choose "Change to Always Allow" to keep sharing your position in the background. You can change this anytime in Settings.';
    }

    if (props.settings) {
        return `Next, CloudTAK will open your device settings. Set Location to ${always} to share your position with your team, including in the background.`;
    } else if (android) {
        return 'Next, Android will ask for location access. Choose "While using the app" or "Allow all the time" to continue. You can change this anytime in Settings.';
    } else if (isIOSPlatform()) {
        return 'Next, iOS will ask for location access. Choose "Allow While Using App" to continue. You can change this anytime in Settings.';
    }

    return 'Next, your browser will ask for location access. You can change this anytime in your browser settings.';
});
</script>
