export async function runWithAbort(session, operation) {
  try {
    return await operation(session);
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction().catch(() => undefined);
    throw error;
  }
}
