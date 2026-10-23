import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../auth/auth-context";
import { api } from "../../lib/api";
import type { Category, Channel } from "../../lib/types";

export function useCategories() {
  const token = useAuth();
  return useQuery({
    queryKey: ["categories", token],
    queryFn: ({ signal }) => api<Category[]>("/categories", { token, signal }),
    enabled: !!token,
  });
}

export function useCategory(categoryId: string) {
  const token = useAuth();
  return useQuery({
    queryKey: ["category", token, categoryId],
    queryFn: ({ signal }) =>
      api<Category>(`/categories/subs?id=${encodeURIComponent(categoryId)}`, {
        token,
        signal,
      }),
    enabled: !!token && !!categoryId,
  });
}

export function useCategoryActions() {
  const token = useAuth();
  const cache = useQueryClient();
  const pending = useIsMutating({ mutationKey: ["library-write", token] }) > 0;
  const cancelReads = () =>
    Promise.all([
      cache.cancelQueries({ queryKey: ["categories", token] }),
      cache.cancelQueries({ queryKey: ["category", token] }),
    ]);
  const refresh = () =>
    Promise.all([
      cache.invalidateQueries({ queryKey: ["categories", token] }),
      cache.invalidateQueries({ queryKey: ["category", token] }),
    ]);
  const create = useMutation({
    mutationKey: ["library-write", token],
    onMutate: cancelReads,
    onSettled: refresh,
    mutationFn: (name: string) =>
      api<Category[]>("/categories", {
        token,
        method: "POST",
        body: { category: name },
      }),
    onSuccess: (categories) =>
      cache.setQueryData(["categories", token], categories),
  });
  const rename = useMutation({
    mutationKey: ["library-write", token],
    onMutate: cancelReads,
    onSettled: refresh,
    mutationFn: ({
      categoryId,
      categoryName,
    }: {
      categoryId: string;
      categoryName: string;
    }) =>
      api<Category>("/categories", {
        token,
        method: "PATCH",
        body: { categoryId, categoryName },
      }),
    onSuccess: (category) => {
      cache.setQueryData(["category", token, category._id], category);
      cache.setQueryData<Category[]>(["categories", token], (categories) =>
        categories?.map((item) =>
          item._id === category._id ? category : item,
        ),
      );
    },
  });
  const remove = useMutation({
    mutationKey: ["library-write", token],
    onMutate: cancelReads,
    onSettled: refresh,
    mutationFn: (categoryId: string) =>
      api<Category[]>("/categories", {
        token,
        method: "DELETE",
        body: { categoryId },
      }),
    onSuccess: (categories, categoryId) => {
      cache.setQueryData(["categories", token], categories);
      cache.removeQueries({
        queryKey: ["category", token, categoryId],
        exact: true,
      });
    },
  });
  return { create, rename, remove, pending };
}

export function useCategoryChannels(categoryId: string) {
  const token = useAuth();
  const cache = useQueryClient();
  const pending = useIsMutating({ mutationKey: ["library-write", token] }) > 0;
  const cancelReads = () =>
    Promise.all([
      cache.cancelQueries({ queryKey: ["categories", token] }),
      cache.cancelQueries({ queryKey: ["category", token, categoryId] }),
    ]);
  const refresh = () =>
    Promise.all([
      cache.invalidateQueries({ queryKey: ["categories", token] }),
      cache.invalidateQueries({ queryKey: ["category", token, categoryId] }),
    ]);
  const updateCategory = (category: Category) => {
    cache.setQueryData(["category", token, categoryId], category);
    cache.setQueryData<Category[]>(["categories", token], (categories) =>
      categories?.map((item) => (item._id === categoryId ? category : item)),
    );
  };
  const add = useMutation({
    mutationKey: ["library-write", token],
    onMutate: cancelReads,
    onSettled: refresh,
    mutationFn: (channel: Channel) =>
      api<Category>("/categories", {
        token,
        method: "PUT",
        body: { categoryId, sub: channel },
      }),
    onSuccess: updateCategory,
  });
  const remove = useMutation({
    mutationKey: ["library-write", token],
    onMutate: cancelReads,
    onSettled: refresh,
    mutationFn: (channel: Channel) =>
      api<Channel[]>("/categories/sub", {
        token,
        method: "DELETE",
        body: { categoryId, channelId: channel.channelId },
      }),
    onSuccess: async (subs) => {
      const current = cache.getQueryData<Category>([
        "category",
        token,
        categoryId,
      ]);
      if (current) await updateCategory({ ...current, subs });
      else
        await cache.invalidateQueries({
          queryKey: ["category", token, categoryId],
        });
    },
  });
  return { add, remove, pending };
}
