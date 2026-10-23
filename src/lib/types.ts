export interface Channel {
  _id?: string;
  channelId: string;
  subName: string;
  channelDesc: string;
  channelThumbnails: { default: string; medium: string; high: string };
}

export interface Category {
  _id: string;
  categoryName: string;
  subs: Channel[];
}

export interface SearchChannel {
  id: { channelId: string };
  snippet: {
    channelTitle: string;
    description: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
}

export interface Video {
  snippet: {
    publishedAt: string;
    title: string;
    channelTitle: string;
    channelId?: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
  contentDetails: { videoId: string };
}
