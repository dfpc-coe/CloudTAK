<template>
<div>
    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class='col-12'>
                    <ProfileTokens/>
                </div>
            </div>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import ProfileTokens from './profile/Tokens.vue';

export default {
    name: 'Profile',
    components: {
        PageFooter,
        ProfileTokens
    }
}
</script>
