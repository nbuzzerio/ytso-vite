const baseUrl = process.env.API_URL;
const apiKey = process.env.API_KEY;

interface genericDictionary {
  [key: string]: string;
}

export interface FetchResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

export interface ReqConfigProps {
  params?: {
    genres?: string;
    parent_platforms?: string;
    ordering?: string;
    search?: string;
    page?: number;
  };
}

export enum ReqMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
}

const getAll = <T>(
  endpoint: string,
  method: ReqMethod,
  signal: AbortSignal,
  requestConfig?: ReqConfigProps,
): Promise<FetchResponse<T>> => {
  const url = new URL("/api" + endpoint, baseUrl);

  const rcp = requestConfig?.params as genericDictionary;
  const filters = {} as genericDictionary;

  if (rcp) {
    Object.keys(rcp).forEach((key) => {
      if (rcp[key]) filters[key] = rcp[key];
    });
  }

  const params = {
    ...(apiKey ? { key: apiKey } : {}),
    ...filters,
  };

  url.search = new URLSearchParams(params).toString();

  return fetch(url.href, {
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
    signal,
  }).then<FetchResponse<T>>((res) => res.json());
};

const get = <T>(
  endpoint: string,
  method: ReqMethod,
  signal: AbortSignal,
  requestConfig?: ReqConfigProps,
): Promise<T> => {
  const url = new URL("/api" + endpoint, baseUrl);

  const rcp = requestConfig?.params as genericDictionary;
  const filters = {} as genericDictionary;

  if (rcp) {
    Object.keys(rcp).forEach((key) => {
      if (rcp[key]) filters[key] = rcp[key];
    });
  }

  const params = {
    ...(apiKey ? { key: apiKey } : {}),
    ...filters,
  };

  url.search = new URLSearchParams(params).toString();

  return fetch(url.href, {
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
    signal,
  }).then<T>((res) => res.json());
};

export default { get, getAll };
