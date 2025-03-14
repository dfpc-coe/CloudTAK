import { Ajv } from 'ajv';

const ajv = new Ajv({
    strict: false,
    allErrors: true,
    useDefaults: true,
    removeAdditional: 'all',
    coerceTypes: true
});

export default class TypeValidator {
    /**
     * Arbitrary JSON objects occasionally need to get typed
     *
     * This function provides the ability to strictly type unknown objects at runtime
     */
    static type<T>(schema: object, body: unknown): T {
        const validate = ajv.compile(schema);

        if (!validate(body)) {
            console.error('Validation Error', validate.errors)
            throw new Error('Validation Error');
        }

        return body as T;
    }
}
