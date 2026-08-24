import AsyncStorage from '@react-native-async-storage/async-storage';

const TUTORIAL_VERSION = 'v1';
const DISCOVER_COACH_VERSION = 'v2';

export const tutorialState = {
  requireProductTutorial(userId: string) {
    return AsyncStorage.setItem(productTutorialKey(userId), 'required');
  },

  completeProductTutorial(userId: string) {
    return AsyncStorage.setItem(productTutorialKey(userId), 'done');
  },

  async getProductTutorialStatus(userId: string) {
    return AsyncStorage.getItem(productTutorialKey(userId));
  },

  completeDiscoverCoach(userId: string) {
    return AsyncStorage.setItem(discoverCoachKey(userId), 'done');
  },

  async hasCompletedDiscoverCoach(userId: string) {
    return (await AsyncStorage.getItem(discoverCoachKey(userId))) === 'done';
  },
};

function productTutorialKey(userId: string) {
  return `wichu:product-tutorial:${TUTORIAL_VERSION}:${userId}`;
}

function discoverCoachKey(userId: string) {
  return `wichu:discover-coach:${DISCOVER_COACH_VERSION}:${userId}`;
}
