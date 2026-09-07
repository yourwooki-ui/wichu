# WICHU 디자인·모션 소스 기록

확인: 2026-09-07. 사용자 제공 브랜드 보드를 최상위 시각 기준으로 적용한다. 기존 로고·앱 아이콘은 변경하지 않는다.

## 탐색 경로와 실제 사용 구분

SNS 공유 자료는 후보를 발견하는 경로이며, 유명세나 공유 횟수를 라이선스·품질의 근거로 삼지 않는다. Instagram·Threads의 개별 추천 게시물은 이번 검색에서 충분히 직접 검증되지 않았다. 아래는 접근 가능한 제작자·서비스 원문을 확인한 목록이다. 로그인/유료 화면을 우회하거나 타 앱의 화면·사진을 가져오지 않았다.

| 소스                                                            | 용도와 이번 판단                                                                                                                                              | 제품 포함 여부           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| [Rachel How 리소스](https://www.rachelhow.com/resources)        | 디자이너가 공개한 리소스 목록. Mobbin 추천 확인. 제휴 링크가 있으므로 추천과 중립 평가를 구분                                                                 | 참고 링크만              |
| [Mobbin](https://mobbin.com/)                                   | 앱 UI·사용 흐름 참고 라이브러리. 사진 중심의 정보 우선순위와 화면 패턴 조사 후보                                                                              | 화면/에셋 복제 없음      |
| [60fps 카드 스택](https://60fps.design/shots/filter/card-stack) | 카드 스택·스와이프 패턴 카탈로그. 다음 카드의 연속성과 행동 피드백이라는 검수 기준에 사용                                                                     | 코드/영상 복제 없음      |
| [Reactiive](https://reactiive.io/)                              | React Native 모션 튜토리얼·오픈소스 데모 탐색. 개별 저장소 라이선스 확인 전 복사 금지                                                                         | 외부 코드 복사 없음      |
| [Ionicons](https://ionic.io/ionicons)                           | 공식 MIT 오픈소스 아이콘. 기존 Expo 패키지 재사용, 일반 헤더와 신규 그래픽의 선형/솔리드 아이콘 체계 통일                                                     | 기존 의존성으로 사용     |
| [LottieFiles 라이선스](https://lottiefiles.com/page/license)    | 공개 무료 애니메이션의 사용 조건 확인. [개별 페이지 라이선스 확인 안내](https://help.lottiefiles.com/discovering-downloading-and-uploading-animations)도 확인 | 이번 변경에는 도입 안 함 |
| [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)          | 설치된 Expo/React Native 버전의 구현 기준                                                                                                                     | 기존 SDK 유지            |

## 이번에 제작한 에셋

`src/components/BrandArtwork.tsx`의 `pick`, `connection`, `chat`: 기울어진 카드, 얇은 궤도선, 연결 마크를 React Native View와 기존 Ionicons로 구성했다. 브랜드 보드 전체 이미지를 UI 배경으로 넣거나 인물 사진을 추출하지 않았다. 네트워크 요청·새 이미지 디코더·무한 반복 모션 없이 해상도에 독립적으로 렌더링한다.

사용처: 발견 빈 상태, 연결 빈 상태, 대화 빈 상태. 오류는 성공/매치 그래픽으로 위장하지 않고 별도 오류 상태를 유지한다.

## 적용 규칙

- 일반 헤더: 23px Ionicons. 기존 3D 에셋은 탭·핵심 상태에서만 사용하며 로고는 보존.
- 선택: Pink, 매치·접속: Lime, 정보: Black/White. 파스텔 배경 장식 제거.
- 매치 순간: 검정 무대 → 라임 제목 → 기울어진 인물 카드 → 설명/핑크 CTA. 접근성 모션 줄이기에서는 즉시 최종 상태 표시.
- 목록: Reanimated 진입/레이아웃은 외부 View, 터치 스타일은 내부 Pressable에 분리. style 콜백이 애니메이션 래퍼에 유실되지 않도록 유지.
- 빠른 카드 입력: 단일 탭/더블 탭/스와이프/명시적 버튼 사이의 지연 탐색은 하나의 컨트롤러가 관리. 프로필 교체·언마운트에서 취소.
- 새 라이브러리는 기존 Reanimated·Expo Image·Ionicons로 구현할 수 없는 필요가 입증될 때 추가. 출처·버전·라이선스·사용 위치를 이 문서에 기록.

## 검수 화면

개발 환경에서만 `/design-qa?scene=discover`, `matches`, `chat`, `tutorial`, `artwork`를 사용한다. 프로덕션에서는 기존처럼 홈으로 Redirect한다. 이 화면의 샘플은 실사용자 데이터나 매치 성공을 증명하지 않는다.

자동 테스트와 웹 렌더 검수는 Android 실기기 키보드·TalkBack·프레임 타이밍 검증을 대체하지 않는다. Android export는 Hermes 번들 검증이며 서명된 AAB 빌드/Google Play 출시와 다르다.

### 이번 실행 결과

- `npm run verify`: SDK 호환성, 보안·라우트·네이티브 시작·UI 정적 검사, TypeScript, ESLint, Vitest 통과. 43 파일 / 173 테스트.
- 변경 파일 Prettier 검사 및 `git diff --check` 통과.
- Android 프로덕션 Hermes export 성공 (`artifacts/brand-android-check`).
- 인앱 브라우저 360×740 / 320×568: 연결 카테고리 전환, 채팅 검색/검색 결과 없음/초기화, 브랜드 그래픽, 튜토리얼 3단계, 매치 모달 확인.
- QA 덱에서 Pick 버튼 더블 클릭 후 Lina → Noah 한 장만 진행되는 것을 확인. 지연 탭 취소 컨트롤러는 별도 7개 테스트로 검사.
- 샘플을 이용한 웹 검수이며 실사용 계정에 Pick/메시지를 전송하지 않음. Android 실기기 조작, 새 AAB 서명 빌드, Play 업로드·출시는 이번 실행에 포함하지 않음.
