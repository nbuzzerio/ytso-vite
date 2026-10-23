export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  token?: string | null;
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token, method = "GET", body, signal } = options;
  if (!navigator.onLine)
    throw new ApiError(
      "You're offline. Reconnect to load your library, search YouTube, or save changes.",
      0,
    );
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}api${endpoint}`, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { "x-auth-token": token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      "Unable to reach the server. Check your connection and try again.",
      0,
    );
  }
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError(
      "The server returned an unexpected response. Please try again.",
      response.status,
    );
  }
  if (!response.ok) {
    if (response.status === 401 && token) {
      window.dispatchEvent(
        new CustomEvent("ytso:unauthorized", { detail: token }),
      );
    }
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "We couldn't complete that request. Please try again.";
    throw new ApiError(message, response.status);
  }
  return data as T;
}
