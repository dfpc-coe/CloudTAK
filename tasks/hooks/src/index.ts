import Lambda from "aws-lambda";
import jwt from 'jsonwebtoken';

export async function handler(
    event: Lambda.SQSEvent,
    context: Lambda.Context,
): Promise<boolean> {
    console.error(event);
};
