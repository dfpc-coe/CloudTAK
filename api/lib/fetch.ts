import Err from '@openaddresses/batch-error';
import { Static, TSchema, TUnknown } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { fetch, Response } from 'undici';
import type { RequestInfo, RequestInit } from 'undici';

export class TypedResponse extends Response {
    constructor(response: Response) {
        super(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    }

    typed<T extends TSchema>(type: T): Promise<Static<T>>;

    async typed<T extends TSchema = TUnknown>(type: T): Promise<Static<T>> {
        const body = await this.json();

        const typeChecker = TypeCompiler.Compile(type)
        const result = typeChecker.Check(body);

        if (result) return body;

        const errors = typeChecker.Errors(body);
        const firstError = errors.First();

        throw new Err(500, null, `Internal Validation Error: ${JSON.stringify(firstError)}`);
    }
}

export default async function(
    input: RequestInfo,
    init?: RequestInit
): Promise<TypedResponse> {
    return new TypedResponse(await fetch(input, init));
}
