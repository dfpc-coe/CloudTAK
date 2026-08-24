import type { Static } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import { Ajv } from 'ajv';
import { sql, and, eq, inArray } from 'drizzle-orm';
import type { AuthUser } from '../../../common/auth.js';
import type { CoreFormResponse, CoreFormResponseResponse } from '../../../common/types.js';
import {
    CoreFormResponse as CoreFormResponseTable,
    CoreEventResponse as CoreEventResponseTable,
} from '../../../common/schema.js';
import type ConfigStateless from '../../config.js';
import { userChannels } from '../tak-channels.js';

/**
 * Access control and JSON Schema validation shared by the Core Form &
 * Form Response endpoints
 */
export default class FormControl {
    config: ConfigStateless;

    constructor(config: ConfigStateless) {
        this.config = config;
    }

    /** Is the requester the author of the Form - the user that created it or a System Admin */
    isFormAuthor(user: AuthUser, form: Static<typeof CoreFormResponse>): boolean {
        return user.is_admin() || form.username === user.email;
    }

    /**
     * A Form is visible to its author, System Admins, and any user with an
     * active channel the Form has been shared with
     */
    async ensureFormAccess(user: AuthUser, form: Static<typeof CoreFormResponse>): Promise<void> {
        if (this.isFormAuthor(user, form)) return;

        const shared = (form.channels || []).map(c => Number(c));
        if (shared.length) {
            const active = await userChannels(this.config, user.email);
            if (shared.some(c => active.has(c))) return;
        }

        throw new Err(403, null, 'You do not have permission to access this Form');
    }

    /** Resolve a Form and check the caller may see it */
    async formAccess(user: AuthUser, id: string): Promise<Static<typeof CoreFormResponse>> {
        const form = await this.config.models.CoreForm.augmented_from(id);

        await this.ensureFormAccess(user, form);

        return form;
    }

    /**
     * Resolve a Response alongside the Form it was submitted against - the
     * caller must have access to the Form and the Response must belong to it
     */
    async responseAccess(user: AuthUser, form: string, id: string): Promise<{
        form: Static<typeof CoreFormResponse>;
        response: Static<typeof CoreFormResponseResponse>;
    }> {
        const f = await this.formAccess(user, form);

        const response = await this.config.models.CoreFormResponse.augmented_from(id);

        if (response.form !== f.id) {
            throw new Err(404, null, 'Response does not belong to this Form');
        }

        return { form: f, response };
    }

    /** May the requester edit or delete a Response - the submitter, the Form author, or a System Admin */
    canEditResponse(user: AuthUser, form: Static<typeof CoreFormResponse>, response: Static<typeof CoreFormResponseResponse>): boolean {
        return this.isFormAuthor(user, form) || response.username === user.email;
    }

    /**
     * The required Forms of a Column the given Event has no linked Response
     * for - placing an Event into a Column is refused until this is empty
     */
    async missingRequiredForms(column: string, event: string): Promise<Array<Static<typeof CoreFormResponse>>> {
        const required = await this.config.models.CoreFormColumn.list({
            limit: 1000,
            where: sql`"column" = ${column} AND required = True`,
        });

        if (!required.items.length) return [];

        const satisfied = await this.config.pg
            .select({ form: CoreFormResponseTable.form })
            .from(CoreFormResponseTable)
            .innerJoin(CoreEventResponseTable, eq(CoreEventResponseTable.response, CoreFormResponseTable.id))
            .where(and(
                inArray(CoreFormResponseTable.form, required.items.map(r => r.form)),
                eq(CoreEventResponseTable.event, event),
            ));

        const have = new Set(satisfied.map(s => s.form));
        const missing = required.items.filter(r => !have.has(r.form));

        if (!missing.length) return [];

        const forms = await this.config.models.CoreForm.augmented_list({
            limit: missing.length,
            where: sql`id IN ${missing.map(m => m.form)}`,
        });

        return forms.items;
    }

    /** Refuse a Form schema that is not a compilable JSON Schema */
    ensureValidSchema(schema: Record<string, unknown>): void {
        try {
            // A fresh instance per compile - schemas with an $id would collide
            // in a shared Ajv registry on recompile
            new Ajv().compile(schema);
        } catch (err) {
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Invalid Schema');
        }
    }

    /** Validate submitted Response data against the Form's JSON Schema */
    validateResponse(form: Static<typeof CoreFormResponse>, response: Record<string, unknown>): void {
        const ajv = new Ajv({ allErrors: true });

        let validate;
        try {
            validate = ajv.compile(form.schema);
        } catch (err) {
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Invalid Form Schema');
        }

        if (!validate(response)) {
            throw new Err(400, null, `Response does not match the Form schema: ${ajv.errorsText(validate.errors)}`);
        }
    }
}
