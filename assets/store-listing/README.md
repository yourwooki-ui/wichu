# WICHU Google Play Store Assets

## 제출 파일

`ko-KR/v2-phone/` 안의 파일 8개를 기본 한국어 스토어 등록정보의 휴대전화 애셋에 순서대로 사용한다.

- `app-icon-512.png`: 512 × 512 앱 아이콘
- `feature-graphic-1024x500.jpg`: 1,024 × 500 그래픽 이미지(현재 제출본 유지)
- `01-welcome-1080x1920.jpg`: 포용적인 첫인상과 핵심 메시지
- `02-discover-1080x1920.jpg`: 남성 모델을 사용한 발견 카드
- `03-match-1080x1920.jpg`: 상호 Pick과 대화 시작
- `04-translation-chat-1080x1920.jpg`: 선택형 메시지 번역
- `05-profile-1080x1920.jpg`: 소개·기본 정보·관심사·언어
- `06-filters-1080x1920.jpg`: 성별·나이·거리·언어 탐색 조건
- `07-safety-1080x1920.jpg`: 신고·차단·대화방 나가기·위치 보호
- `08-gold-1080x1920.jpg`: Gold Pass 혜택

휴대전화 스크린샷은 번호 순서대로 업로드한다. 첫 화면에서 `글로벌 친구·언어교환`의 성격을 먼저 전달하고, 이후 `발견 → 상호 Pick → 번역 채팅 → 탐색 조건`이 이해되도록 구성했다.

Tinder·Bumble·Hinge·Tandem의 현재 Google Play 등록정보를 비교해 다음 원칙을 적용했다.

- 첫 3장에서 감정적 가치 → 핵심 탐색 → 상호 연결을 완결한다.
- 한 장에 한 가지 약속만 두고, 작은 Play 미리보기에서도 읽히는 큰 제목을 쓴다.
- 두꺼운 기기 프레임을 제거해 실제 UI 면적을 넓힌다.
- 첫 장은 성별과 국적이 균형 잡힌 친구 그룹, 발견·상세 프로필은 남성 모델, 매치는 혼합 인물로 구성한다.
- 핑크·오프화이트·블랙·라임·골드의 용도를 고정해 장별 분위기는 달라도 WICHU로 인식되게 한다.
- 운영체제 이모지 폰트에 의존하지 않아 Play 이미지에서 네모 글리프가 생기지 않게 한다.

## v2 휴대전화 애셋 다시 생성

```powershell
& 'C:\Users\LL\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tools\store-assets\build_phone_assets_v2.py
```

생성 원본은 `source/feature-inclusive-v2.png`에 보관한다. 스크립트가 함께 만드는 피처 그래픽 시안은 보관용이며, Play Console의 일반적인 시각적 애셋에는 반영하지 않는다. 기존 제출 파일은 비교와 롤백을 위해 덮어쓰지 않는다.

## v2 대화면 애셋

- `ko-KR/v2-tablet-7/`: 7인치 태블릿용 세로 스크린샷 8장, 1440 × 2560
- `ko-KR/v2-tablet-10/`: 10인치 태블릿용 가로 스크린샷 8장, 2560 × 1440
- `ko-KR/v2-chromebook/`: Chromebook용 가로 스크린샷 4장, 2560 × 1440

대화면 애셋은 휴대전화용으로 확정한 WICHU UI를 중심에 두고, 가짜 기기 프레임 없이 큰 화면에서 핵심 정보와 조작이 읽히게 다시 구성한다. Android XR은 실제 XR 기기 또는 에뮬레이터에서 호환성과 화면을 검증하기 전까지 비워 둔다. 휴대전화·태블릿 이미지를 복사해 XR 경험처럼 보이게 하는 것은 등록정보가 실제 앱 경험과 달라질 수 있기 때문이다.

```powershell
& 'C:\Users\LL\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tools\store-assets\build_large_screen_assets_v2.py
```

## 다시 생성

```powershell
& 'C:\Users\LL\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tools\store-assets\build_store_assets.py
```

`source/`에는 앱의 개발용 mock 프로필과 동일한 Unsplash 이미지 및 WICHU 브랜드 보드를 참고해 생성한 그래픽 이미지 원본이 있다. 스토어 이미지의 인물은 서비스 설명을 위한 연출 이미지이며 실제 회원이 아니다.
