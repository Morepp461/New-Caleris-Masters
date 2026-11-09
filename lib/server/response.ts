import {NextResponse} from "next/server";
import {normalizeError} from "./errors";
export type RequestMeta={correlationId:string;requestId:string};
export function success<T>(data:T,meta:RequestMeta,status=200){return NextResponse.json({success:true,data,meta},{status,headers:{"x-correlation-id":meta.correlationId}});}
export function failure(error:unknown,meta:RequestMeta){const e=normalizeError(error);return NextResponse.json({success:false,error:{code:e.code,message:e.message,...(e.details?{details:e.details}:{})},meta},{status:e.status,headers:{"x-correlation-id":meta.correlationId}});}