export const chatState = {
  friendsList: [],
  conversations: [],
  activeConversationId: null,
  activeMessages: [],
  activeWallpaper: localStorage.getItem('chatWallpaper') || 'default',
  messageRefreshTimer: null,
  messageRefreshInFlight: false,
  animatedMessageIds: new Set(),
};
