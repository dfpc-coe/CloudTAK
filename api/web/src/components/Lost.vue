<template>
    <div class='col col--12 grid pt12'>
        <div class='col col--12 flex flex--center-main'>
            <h3 class='flex-child txt-h4 py6'>Not all who wander are lost</h3>
        </div>
        <div class='col col--12 flex flex--center-main'>
            <h3 class='flex-child txt-h5 py6'>But you are!</h3>
        </div>

        <button @click='$router.push("/")' class='mt12 w-full color-gray color-green-on-hover btn btn--stroke round'>Take Me Home</button>
    </div>
</template>

<script>
export default {
    name: 'Lost'
}
</script>
