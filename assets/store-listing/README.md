# WICHU Google Play Store Assets

## 제출 파일

`ko-KR/` 안의 파일을 기본 한국어 스토어 등록정보에 순서대로 사용한다.

- `app-icon-512.png`: 512 × 512 앱 아이콘
- `feature-graphic-1024x500.jpg`: 1,024 × 500 그래픽 이미지
- `01-discover-1080x1920.jpg`
- `02-match-1080x1920.jpg`
- `03-translation-chat-1080x1920.jpg`
- `04-filters-1080x1920.jpg`
- `05-profile-1080x1920.jpg`
- `06-safety-1080x1920.jpg`

휴대전화 스크린샷은 번호 순서대로 업로드한다. 첫 네 장만 보더라도 `발견 → 상호 Pick → 번역 채팅 → 탐색 조건`이 이해되도록 구성했다.

## 다시 생성

```powershell
& 'C:\Users\LL\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tools\store-assets\build_store_assets.py
```

`source/`에는 앱의 개발용 mock 프로필과 동일한 Unsplash 이미지 및 WICHU 브랜드 보드를 참고해 생성한 그래픽 이미지 원본이 있다. 스토어 이미지의 인물은 서비스 설명을 위한 연출 이미지이며 실제 회원이 아니다.
