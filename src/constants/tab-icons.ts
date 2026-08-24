export const tabIconSources = {
  matches: require('../../assets/tab-icons/matches.png'),
  chat: require('../../assets/tab-icons/chat.png'),
  discover: require('../../assets/tab-icons/discover.png'),
  shop: require('../../assets/tab-icons/shop.png'),
  me: require('../../assets/tab-icons/me.png'),
} as const;

export type TabName = keyof typeof tabIconSources;
