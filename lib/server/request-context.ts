import {randomUUID} from "node:crypto";
import type {NextRequest} from "next/server";
import type {RequestMeta} from "./response";
const UUID_V4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function getRequestMeta(request:NextRequest):RequestMeta{const supplied=request.headers.get("x-correlation-id");return{correlationId:supplied&&UUID_V4.test(supplied)?supplied:randomUUID(),requestId:randomUUID()};}