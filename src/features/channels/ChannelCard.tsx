import type { ReactNode } from "react";
import type { Channel } from "../../lib/types";
import placeholder from "../../assets/no-image-placeholder.webp";

interface ChannelCardProps {
  channel: Channel;
  actions?: ReactNode;
  badges?: ReactNode;
}

export default function ChannelCard({
  channel,
  actions,
  badges,
}: ChannelCardProps) {
  return (
    <article className="channel-card stack" data-channel-id={channel.channelId}>
      <div className="flex min-w-0 items-center gap-4">
        <img
          className="channel-avatar h-16 w-16 shrink-0 rounded-full object-cover"
          src={
            channel.channelThumbnails.medium ||
            channel.channelThumbnails.default ||
            placeholder
          }
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = placeholder;
          }}
          width="64"
          height="64"
          loading="lazy"
          alt=""
        />
        <h3 className="min-w-0 break-words text-lg font-semibold">
          {channel.channelId ? (
            <a
              href={`https://www.youtube.com/channel/${encodeURIComponent(channel.channelId)}`}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {channel.subName}
              <span className="sr-only"> (opens YouTube in a new tab)</span>
            </a>
          ) : (
            channel.subName
          )}
        </h3>
      </div>
      {channel.channelDesc && (
        <p className="line-clamp-3 break-words text-sm">
          {channel.channelDesc}
        </p>
      )}
      {!channel.channelId && (
        <p className="text-sm">
          YouTube link unavailable for this saved channel.
        </p>
      )}
      {badges && <div className="flex flex-wrap gap-2">{badges}</div>}
      {actions && <div className="mt-auto pt-2">{actions}</div>}
    </article>
  );
}
