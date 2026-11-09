import{AppError}from"./errors";
const VALID=/^[A-Za-z0-9._:-]{8,128}$/;
export function requireIdempotencyKey(value:string|null):string{if(!value||!VALID.test(value))throw new AppError("IDEMPOTENCY_KEY_REQUIRED","A valid Idempotency-Key header (8–128 safe characters) is required.",400);return value;}