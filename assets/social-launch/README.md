# WICHU Social Launch Kit

초기 공식 채널용 정적 이미지 세트다. 이미지에 사용된 인물은 서비스 설명을 위한 연출 이미지이며 실제 회원이 아니다.

## Instagram

`instagram/`의 1080 × 1080 이미지 6장을 다음 순서로 게시한다.

1. 브랜드 소개 — 새로운 언어, 새로운 친구
2. 상호 Pick — 서로 Pick하면 대화 시작
3. 메시지 번역 — 원문과 번역을 함께 확인
4. 친구 발견 — 한 명씩 충분히 살펴보기
5. 안전 — 위치 보호, 사진 검토, 신고·차단
6. Founding 300 — 초기 멤버 모집

프로필 그리드에서 1번을 가장 최근 게시물로 보이게 하려면 실제 업로드는 `06 → 05 → 04 → 03 → 02 → 01` 역순으로 진행한다.

## TikTok

`tiktok/`의 1080 × 1920 이미지 6장은 포토 모드 게시물, 슬라이드형 콘텐츠, 영상 커버로 사용할 수 있다. 중요한 문구는 TikTok UI에 가리지 않도록 상단과 하단 가장자리에서 충분히 띄웠다.

## Source and rebuild

- `source/campaign-friends-square.png`: ImageGen으로 만든 글로벌 친구 그룹 키비주얼
- `source/campaign-mutual-pick-vertical.png`: ImageGen으로 만든 상호 Pick 키비주얼
- 실제 제품 표현은 `assets/store-listing/ko-KR/v2-phone/`의 WICHU 스크린샷을 사용한다.

다시 생성:

```powershell
& 'C:\Users\LL\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tools\social-assets\build_social_launch_kit.py
```

게시 전 공식 계정 핸들이 `@wichu.app`과 다르면 생성 스크립트의 푸터 문구를 수정하고 다시 생성한다.
