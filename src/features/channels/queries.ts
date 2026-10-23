import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../auth/auth-context";
import { api } from "../../lib/api";
import type { Channel } from "../../lib/types";

export function useChannels() {
  const token = useAuth();
  return useQuery({
    queryKey: ["channels", token],
    queryFn: ({ signal }) => api<Channel[]>("/subs", { token, signal }),
    enabled: !!token,
  });
}

export function useChannelActions() {
  const token = useAuth();
  const cache = useQueryClient();
  const pending = useIsMutating({ mutationKey: ["library-write", token] }) > 0;
  const cancelReads = () =>
    Promise.all([
      cache.cancelQueries({ queryKey: ["channels", token] }),
      cache.cancelQueries({ queryKey: ["categories", token] }),
      cache.cancelQueries({ queryKey: ["category", token] }),
    ]);
  const refresh = () =>
    Promise.all([
      cache.invalidateQueries({ queryKey: ["channels", token] }),
      cache.invalidateQueries({ queryKey: ["categories", token] }),
      cache.invalidateQueries({ queryKey: ["category", token] }),
    ]);
  const save = useMutation({
    mutationKey: ["library-write", token],
    onMutate: cancelReads,
    mutationFn: (channel: Channel) =>
      api<Channel[]>("/subs", { token, method: "POST", body: channel }),
    onSuccess: (channels) => cache.setQueryData(["channels", token], channels),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationKey: ["library-write", token],
    onMutate: cancelReads,
    mutationFn: (channelId: string) =>
      api<Channel[]>("/subs", { token, method: "DELETE", body: { channelId } }),
    onSuccess: (channels) => cache.setQueryData(["channels", token], channels),
    onSettled: refresh,
  });
  return { save, remove, pending };
}
