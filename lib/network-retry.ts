export async function retryOnceOnNetworkFailure<T>(
  request: () => Promise<T>,
  onRetry: () => void = () => {},
  delayMs = 1200
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;

    onRetry();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      return await request();
    } catch (retryError) {
      if (retryError instanceof TypeError) {
        throw new Error("EcoLoop is waking up or temporarily unreachable. Please try again shortly.", {
          cause: retryError,
        });
      }
      throw retryError;
    }
  }
}
