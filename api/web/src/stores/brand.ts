/*
* BrandStore - Maintain Branding accross pages
*/

import { defineStore } from 'pinia'

export const useBrandStore = defineStore('brand', {
    state: (): {
        logo: string
    } => {
        return {
            logo: ''
        }
    },
    actions: {
    }
})
