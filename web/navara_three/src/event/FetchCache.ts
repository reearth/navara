/**
 * Fetch cache for deduplicating concurrent network requests.
 *
 * When multiple requests for the same URL are made concurrently,
 * the FetchCache ensures only one network request is made.
 */
export class FetchCache {
  /** Maps URL to pending fetch promise for deduplication */
  private pendingRequests = new Map<string, Promise<void>>();

  /**
   * Get or create a pending fetch promise.
   *
   * This deduplicates concurrent fetches for the same URL.
   * If a fetch is already in progress, returns the existing promise.
   *
   * @param url - The resource URL
   * @param fetcher - Function to perform the actual fetch (only called once)
   * @returns Promise that resolves when fetch completes
   */
  getOrCreateFetchPromise(
    url: string,
    fetcher: () => Promise<void>,
  ): Promise<void> {
    const existing = this.pendingRequests.get(url);
    if (existing) {
      return existing;
    }

    const promise = fetcher().finally(() => {
      // Clean up after fetch completes (success or failure)
      this.pendingRequests.delete(url);
    });

    this.pendingRequests.set(url, promise);
    return promise;
  }

  /**
   * Check if a fetch is already pending for a URL.
   *
   * @param url - The resource URL
   * @returns true if fetch is in progress
   */
  isPending(url: string): boolean {
    return this.pendingRequests.has(url);
  }

  /**
   * Clear all pending requests.
   * Called during cleanup/dispose.
   */
  dispose(): void {
    this.pendingRequests.clear();
  }
}
