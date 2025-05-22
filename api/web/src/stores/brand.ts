/*
* BrandStore - Maintain Branding accross pages
*/

import { defineStore } from 'pinia'
const mapStore = useMapStore();

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
