import Err from '@openaddresses/batch-error';
import { Static, TSchema, TUnknown } from "@sinclair/typebox";
import { TypeCheck } from "@sinclair/typebox/compiler";

export class TypedResponse extends Response {
    constructor(response: Response) {
        super(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    }

    json(): Promise<unknown>;
    json<T extends TSchema>(typeChecker: TypeCheck<T>): Promise<Static<T>>;
    async json<T extends TSchema = TUnknown>(
        typeChecker?: TypeCheck<T>
    ): Promise<Static<T>> {
        if (!typeChecker) return super.json();
        const body = await super.json();
        const result = typeChecker.Check(body);
        if (result) return body;

        const errors = typeChecker.Errors(body);
        const firstError = errors.First();

        throw new Err(400, null, `Internal Validation Error: ${firstError}`);
    }
}

export default async function fetch(
    input: RequestInfo,
    init?: RequestInit
): Promise<TypedResponse> {
    return new TypedResponse(await fetch(input, init));
}
