# WICHU Product

## Product concept

WICHU means **Which U? / With You**. It is a global social discovery app for people aged 18–29, with an absolute minimum age of 18. The product borrows only the broad one-person discovery pattern familiar from global friend and dating apps; its brand, design, code, and interaction model are original.

The core loop is:

`Discover a profile → swipe one card → mutual like → match → 1:1 chat → optional translation`

The visual direction is youthful, polished, light, global, and comfortable for women to use. It avoids excessive hearts and familiar dating-app clichés, favoring a modern native consumer-app feel.

## MVP scope

- Extensible email/social authentication and an enforced 18+ profile
- Up to six profile photos
- Name, birth year, gender, interested genders, country, languages, bio, and interests
- Country, age, and gender discovery filters
- One-person swipe deck with Like and Pass
- Automatic mutual-like matching
- 1:1 realtime chat after a match
- Message fields prepared for translation
- Report, block, deactivate, and account-deletion paths
- Free core experience with ads; one Ad-Free in-app purchase later
- Push notification boundary prepared for a future provider

## Initial screens

1. Splash / Login
2. Profile Setup
3. Discover
4. Profile Detail
5. Matches
6. Chat List
7. Chat Room
8. My Profile
9. Settings
10. Ad-Free

The bottom tabs are Discover, Matches, Chat, and Me.

## Explicitly out of scope

Feeds, stories, communities, video calls, AI recommendations, coins, gifts, and item economies are not part of the MVP.

## Performance promise

Swiping never waits for a network round trip. The client keeps the current and upcoming candidates in memory, prefetches upcoming photos, updates optimistically, and refills in the background. Chat follows the same immediate-send model with server reconciliation.
