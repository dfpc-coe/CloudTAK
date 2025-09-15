/**
 * Store typical default API Limits
 */

import { Type } from '@sinclair/typebox';
import { GenericListOrder } from '@openaddresses/batch-generic';

export const Limit = Type.Integer({
    default: 10,
    minimum: 1,
    maximum: 100,
    description: 'Limit the number of responses returned'
});

export const Page = Type.Integer({
    default: 0,
    minimum: 0,
    description: 'Iterate through "pages" of items based on the "limit" query param'
});

export const Order = Type.Enum(GenericListOrder, {
    default: GenericListOrder.ASC,
    description: 'Order in which results are returned based on the "sort" query param'
})

export const Filter = Type.String({
    default: '',
    minLength: 0,
    maxLength: 64,
    description: 'Filter results by a human readable name field'
});

export const NameField = Type.String({
    minLength: 1,
    maxLength: 64,
    description: 'Human readable name'
});

export const DescriptionField = Type.String({
    minLength: 0,
    maxLength: 1024,
    description: 'Human readable description'
});
