export type AnalyticsApp = {
  id: string; // the app's resourceId — what an embed addresses, not the Items record's own id
  name: string;
  updatedAt: string;
  hasThumbnail: boolean; // the app's owner set one; most apps have none
};
