const stringValue = (value) => (typeof value === "string" ? value : "");

// Older embedded records may omit metadata. Normalize only the response so
// clients can render them without rewriting or discarding stored information.
export function serializeChannel(channel) {
  return {
    ...(channel?._id ? { _id: String(channel._id) } : {}),
    channelId: stringValue(channel?.channelId),
    subName: stringValue(channel?.subName).trim() || "Unnamed channel",
    channelDesc: stringValue(channel?.channelDesc),
    channelThumbnails: {
      default: stringValue(channel?.channelThumbnails?.default),
      medium: stringValue(channel?.channelThumbnails?.medium),
      high: stringValue(channel?.channelThumbnails?.high),
    },
  };
}

export function serializeChannels(channels) {
  return Array.isArray(channels) ? channels.map(serializeChannel) : [];
}

export function serializeCategory(category) {
  return {
    _id: category?._id ? String(category._id) : "",
    categoryName:
      stringValue(category?.categoryName).trim() || "Unnamed category",
    subs: serializeChannels(category?.subs),
  };
}

export function serializeCategories(categories) {
  return Array.isArray(categories) ? categories.map(serializeCategory) : [];
}
