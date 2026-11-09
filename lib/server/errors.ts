export type ErrorDetails = Record<string, unknown>;
export class AppError extends Error {
 constructor(public readonly code:string,message:string,public readonly status:number,public readonly details?:ErrorDetails,options?:ErrorOptions){super(message,options);this.name="AppError";}
}
export class ValidationError extends AppError { constructor(details:ErrorDetails){super("VALIDATION_ERROR","Request validation failed.",400,details);} }
export function normalizeError(error:unknown):AppError {
 if(error instanceof AppError)return error;
 if(error&&typeof error==="object"&&"code" in error&&error.code===11000)return new AppError("DUPLICATE_RESOURCE","A resource with the same unique key already exists.",409);
 return new AppError("INTERNAL_ERROR","An unexpected error occurred.",500);
}