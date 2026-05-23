export const chatState = {
  friendsList: [],
  conversations: [],
  activeConversationId: null,
  activeMessages: [],
  pinnedMessages: [],
  activeWallpaper: localStorage.getItem('chatWallpaper') || 'default',
  messageRefreshTimer: null,
  messageRefreshInFlight: false,
  animatedMessageIds: new Set(),
  isTyping: false,
  typingTimeout: null,
  typingUsers: [],
};
