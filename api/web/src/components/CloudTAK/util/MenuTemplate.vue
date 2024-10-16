<template>
    <div class='container px-0'>
        <div
            class='sticky-top col-12 bg-dark'
            style='border-radius: 0px;'
            :class='{
                "border-bottom border-light": border
            }'
        >
            <div class='modal-header px-0 mx-2'>
                <TablerIconButton
                    v-if='backType === "close"'
                    title='Close Menu'
                    icon='IconCircleX'
                    @click='$router.push("/")'
                />
                <TablerIconButton
                    v-if='backType === "back"'
                    title='Close Menu'
                    icon='IconCircleArrowLeft'
                    @click='$router.back()'
                />
                <div v-else/>

                <div
                    class='modal-title d-flex mx-auto'
                    v-text='name'
                />
                <div class='btn-list'>
                    <slot name='buttons' />
                </div>
            </div>
        </div>

        <div
            class='col-12 overflow-auto'
            style='height: calc(100vh - 114px)'
        >
            <TablerLoading
                v-if='loading'
                :desc='`Loading ${name}`'
            />
            <TablerNone
                v-else-if='none'
                :label='name'
                :create='false'
            />
            <slot v-else />
        </div>
    </div>
</template>

<script>
import {
    TablerNone,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

export default {
    name: 'MenuTemplate',
    components: {
        TablerNone,
        TablerLoading,
        TablerIconButton,
    },
    props: {
        name: {
            type: String,
            required: true
        },
        border: {
            type: Boolean,
            default: true
        },
        back: {
            type: Boolean,
            default: true
        },
        loading: {
            type: Boolean,
            default: false,
        },
        none: {
            type: Boolean,
            default: false,
        }
    },
    computed: {
        backType: function() {
            if (!this.back) return "none";

            if (
                !this.$router.options.history.state.back
                || this.$router.options.history.state.back === '/'
            ) {
                return 'close'
            } else {
                return 'back'
            }
        }
    }
}
</script>
