<template>
<div class='w-full bg-white'>
    <div class='flex flex--center-main w-full py24'>
        <div class='loading'></div>
    </div>

    <template v-if='desc && desc.length'>
        <div class='flex flex--center-main w-full'>
            <div class='flex-child py24' v-text='desc'></div>
        </div>
    </template>
</div>
</template>

<script>
export default {
    name: 'Loading',
    props: {
        desc: String
    }
}
</script>
