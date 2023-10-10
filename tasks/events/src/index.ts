import Lambda from "aws-lambda";
import jwt from 'jsonwebtoken';
import S3 from "@aws-sdk/client-s3";
import zlib from "zlib";
// @ts-ignore
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";


export const handler = async (
    event: Lambda.APIGatewayProxyEventV2,
    context: Lambda.Context,
): Promise<Lambda.APIGatewayProxyResult> => {

};
