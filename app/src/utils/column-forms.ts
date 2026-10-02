import { server } from '../std.ts';
import type { CoreForm } from '../types.ts';

/**
 * The required Forms of a Board Column the given Event has no linked Response
 * for - the server refuses to place the Event in the Column until this is
 * empty, so callers surface the FormWizard over this list first
 */
export async function missingRequiredForms(column: string, event: string): Promise<Array<CoreForm>> {
    const attachments = await server.GET('/api/board/column/{:column}/form', {
        params: { path: { ':column': column } }
    });

    if (attachments.error) throw new Error(attachments.error.message);

    const missing: Array<CoreForm> = [];

    for (const attachment of attachments.data.items) {
        if (!attachment.required) continue;

        const responses = await server.GET('/api/core/form/{:form}/response', {
            params: {
                path: { ':form': attachment.form.id },
                query: {
                    limit: 1,
                    page: 0,
                    order: 'asc',
                    sort: 'created',
                    event,
                }
            }
        });

        if (responses.error) throw new Error(responses.error.message);

        if (responses.data.total === 0) missing.push(attachment.form);
    }

    return missing;
}
