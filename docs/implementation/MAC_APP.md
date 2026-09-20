# Ouroboros Mac UI 앱 구현 계획과 작업 기록

## 현재 목표와 확정 사항

사용자는 회장 관점에서 자본·성과·위험과 CEO의 운용을 판단하고 필요할 때 방향·위임을
조정한다. CEO는 사장으로서 그 범위 안의 일상적인 투자·연구·조직·운영을 맡는다.
이 역할 구분을 기준으로 Mac 앱을 설계한다. '회장'이라는 표시로 새 권한을 만들지는 않는다.
앱은 도메인을 모르는 기본 앱과 독립적으로 배포하는 Company UI로 나눈다.
운영 환경도 공통 기반과 Company 서비스로 같은 경계를 갖는다. 제품은 Company UI Host와
기존 Gateway·Runtime·자원을 이용하는 Company Service Host를 제공한다. 투자 계산·강제
한도·주문/계좌 서비스·Binance 어댑터는 회사 패키지에 두고 제품에 내장하지 않는다.
화면 메뉴뿐 아니라 코드 의존성, 데이터 계약, 조회·제어 책임까지 분리한다.
사용자가 업무를 계속 생성해야 움직이는 앱으로 만들지 않는다.

사용자가 원하는 제품 경험은 Grok Bot처럼 각자의 아이덴티티를 가진 에이전트가 회사
안에서 일하는 모습이다. 현재 기본 진입은 개인 Home이며 투자 결과·현재 노출을 먼저 배치할 수 있다.
Company 투자 페이지와 Work·Agents에서 자본의 변화, CEO와 구성원이 무엇을 왜 하는지 확인한다. 개별 실행은 그 업무의
근거로 내려간다. 이름·책임·업무·산출물·협업 관계는 실제
내부 기록에 연결하며 모델/세션 교체에도 이어진다. 고정 부서나 인원수는 만들지 않는다.

구성원 추가의 기준은 역할 이름이 아니라 실제 업무의 효율이다. 기존 구성원의 직접
처리, 도구, 한시적인 보조 실행, 지속적인 전문 구성원 가운데 유용한 방식을 선택한다.
전문성·맥락 유지·병렬 처리·독립 검증의 기대 이점과 비용·조정·중복 업무를 함께 판단한다.
필요와 기대 효과는 기존 업무 기록에 남기며 별도의 채용 심사나 일상 승인 절차는 만들지
않는다. 현재 위임·자원 범위에서 자율적으로 추가하고 실제 결과에 따라 유지·통합·대기·
종료한다. HR/Finance/Researcher라는 직함만으로 구성원을 만들지 않고, 이들이 없어도
기본 관리·원장·잔고·투자 제어는 동작한다. 구체적인 경계는
[Staffing by Work Need](../architecture/CONTRACTS_AND_STATE.md#staffing-by-work-need)에 둔다.

화면의 책임·구성·조회·제어·실패 경계는 하위 아키텍처
[Application Shell and Views](../architecture/APPLICATION_SHELL_AND_VIEWS.md)가 소유한다.
전체 개발·운영·앱·산출물 연결은 [통합 시스템 설계](../architecture/SYSTEM_DESIGN.md)가 정리한다.
이 문서는 그 설계를 구현하는 순서와 실제 작업·검증 기록을 유지한다. main-only source와
Package / Verification / Deployment는 목표 계약이며 아래의 기존 기능과 완료 여부를 구분한다.

- Mac 전용 Tauri / React / TypeScript. 창과 회사 운영 프로세스는 분리한다.
- 디자인 시스템은 OpenBoa Brand System에서 가져온다. 기본 제어, 회사 화면,
  선물투자 화면 모두 동일한 브랜드 토큰과 컴포넌트 기준을 사용한다.
- 기본 컨트롤 플레인은 설치된 제품에 포함한다. 회사·도메인 구성이 변경하거나
  숨기거나 덮어쓸 수 없다. 제품 변경은 별도의 정식 업데이트 경로를 따른다.
- 고정 Workspace는 Home / Work / Agents / System / Conversations / Library / Notifications다.
  기본 관찰·Trace·이력·자료·알림은 Company 구성이나 에이전트 응답에 의존하지 않는다.
  Owner controls는 회사가 숨길 수 없는 별도 고정 진입이다.
- 자본·비용·주문·포지션은 사람 또는 에이전트가 만든 검증된 Company UI·서비스로
  연결한다. CEO 답변 없이 조회할 수 있고 UI와 서비스 수명은 분리한다. Company 서비스가
  없으면 금융 기능은 미연결로 표시하며 제품에 별도 투자 구현을 두지 않는다.
- 금융 제어도 Company operation이다. 고정 Host는 대상·버전·요청·적용 결과와 현재 권한을
  확인하고, 금융 의미·제한은 선택된 Company 서비스가 강제한다. 일반 에이전트나 새 패키지는
  필수 서비스 경로·검증·custody를 우회하거나 운영 중인 제한을 직접 변경할 수 없다.
- 화면 작성자와 검증·활성화 권한은 구별한다. 기존 위임 안의 표시 변경은 매번
  소유자 승인을 요구하지 않으며, 새 조회·권한·실행 코드 추가는 별도 변경 계약이다.
- Company 화면은 사람·에이전트가 별도 비공개 main에서 개발하고 SDK로 독립 빌드한다.
  회사 코드는 제품 앱 빌드에 포함하지 않는다. 정확한 패키지 검증·보호된 선택/적용 기록과
  격리 WebView를 연결한다. 회사 프로필·화면 구성은 독립 데이터이며 게시만으로 코드를 활성화하지 않는다.
- 첫 도메인은 선물투자, 첫 연결은 사용자가 선택한 Binance USDⓈ-M BTCUSDT 무기한이다.
- 계약 선택은 계정 인증·자본·위험 한도·실거래 권한을 설정하지 않는다.
- 이번 우선 결과물은 화면 구성과 제어 경계가 제대로 작동하는 UI 앱이다.
  기존 전체 제품 계획의 자율 운영·실제 투자 기능은 별도 연결 항목으로 유지하며,
  개발 데이터 화면의 완성을 실제 운용 완료로 보고하지 않는다.

근거: PRODUCT_SPECIFICATION.md, ARCHITECTURE.md의 Persistent Private Operation,
OBSERVABILITY_AND_CONSOLE.md의 Owner Oversight 및 List/Detail/Observed Outcome.

<a id="current-checkpoint"></a>
## 2026-09-14 현재 구현 체크포인트

이 절이 현재 UI 구조와 구현 범위의 기준이다. 아래 2026-09-13 설계 비교·4화면 시안·단계별 기록은
당시 판단과 증거를 보존한 역사이며 현재 메뉴, 미도입 목록이나 에이전트 UI 제외 정책으로 인용하지 않는다.

| 영역 | 현재 구현·경계 |
| --- | --- |
| Workspace | 제품 소유 Home / Work / Agents / System / Conversations / Library / Notifications의 7개 경로. Company는 이를 바꾸지 못하며 Owner controls가 별도로 고정돼 있다 |
| Company | 현재 별도 게시 패키지를 native child WebView로 준비·연결하는 기본 코드가 있다. 제품의 사전 포함 Company module registry는 비어 있고 실제 회사 코드를 import하지 않는다. 독립 Verification/Deployment·보존·네이티브 인수는 미완료다 |
| Home | 회사·환경·소유자 scope의 개인 widget 선택·순서·크기를 로컬 저장한다. 공유 Company 구성이나 회사 권한을 변경하지 않는다 |
| Settings | 사이드바에는 진입 하나만 둔다. 화면 상단 가로 스크롤 탭 General / Connections / Company / Modules / Maintenance가 각각 본문을 연다. 표시·연결 전환 조작은 General에 둔다 |
| Company / Modules 설정 | Company는 관측된 구성 선택·후보 가져오기·게시 상태, Modules는 검증된 패키지 metadata와 구성 참조를 표시한다. 새 패키지를 도입하는 후보 설치 흐름과 보호된 운영 적용은 미완료이며 구성 선택을 실제 실행으로 추정하지 않는다 |
| 상세·복귀 | 오른쪽 고정 inspector 대신 본문 전체에 한 상세와 Back/Close를 표시한다. 원래 페이지·선택·대화 문맥과 읽기 위치를 보존한다 |
| Notifications | Core 이벤트·원본 참조·읽음 상태를 조회하고 All/Unread·category·Load more를 제공한다. 읽음과 메뉴 배지는 서버 acknowledgement 뒤 같은 공유 page에서 갱신한다 |

알림은 `GET /notifications`의 opaque cursor와 서버 unread 집계를 사용한다. 읽음은
`POST /notifications/read`에 실제 선택/표시된 ID를 최대 100개 전달하며 광범위한 자동 전체 읽음을 만들지 않는다.
배지는 Notifications=total, Conversations=message, Agents=execution, System=control,
Library=publication, Work=execution+control이다. 한 알림이 여러 화면에 관련되므로 메뉴 배지 합계를
별도 전체 알림 수로 계산하지 않는다. Company별 배지는 정확한 source/target 계약 없이 만들지 않는다.
읽음은 문제 해결·제어 승인·실행 성공이 아니다. 메시지 내용이나 성공 상태를 임의 작성하지 않는다.

Company 구성은 기존 Catalog 업로드·전체 manifest 게시·CAS·정확한 재조회를 사용한다.
Core authority revision, Company 구성 revision, Catalog revision은 별개다. 기존 manifest 항목을 보존하고
pending publication은 원래 request/intent로 확인한다. 가져오기·업로드만으로 활성화 완료라고 표시하지 않는다.
`company_snapshot` 등은 Tauri command 이름이며 기존 conditions/work·관찰·대화·resource 경로를 호출한다.
초기 문서의 가상 `/company/*` API를 현재 서버 구현으로 인용하지 않는다.

회사 원본과 실제 실행 증거는 제품 체크아웃 밖으로 분리했다. 현재 구현과 남은 검증은 [Company 경계 계약](COMPANY_BOUNDARIES.md)을 따른다.

현재 원본은 `apps/mac/src`의 `app/`, `ui/`, `contracts/`, `features/`, `modules/`,
`domains/investment/`, `data/`, `development/`와 `src-tauri/src/company_views.rs`,
`packages/company-ui-sdk/`에 있다. `modules/`는 제품이 소유한 Company host이며 회사 소스가 아니다.
회사 프로필은 아직 UI 구성 workspace 선택에 의존하므로 독립 조회로 분리해야 한다. OpenBoa Martian 전체 typography 역할과
shadcn Mira/Base UI를 공통으로 사용하며 캘리브레이션이 동일 원본을 소비한다.
[앱 실행 방법](../../apps/mac/README.md)과 [UI 구현 계약](../design/UI_IMPLEMENTATION.md)을 따른다.
최종 frontend/계약/빌드 및 화면 결과는 실행 증거에 기록하며 이 절은 변동하는 테스트 수를 고정하지 않는다.

**확인 한계:** 이전 실행 때 Mac 잠금으로 native GUI 파일 선택·저장 dialog, Company child WebView
렌더·script hang·고정 제어 사용·패키지 버전 교체·창 닫기/재열기는 검증하지 못했다.
이번 통합 문서 정리는 새 runtime/GUI 테스트 실행이나 그 한계의 해소를 뜻하지 않는다.
브라우저 화면이나 번들 빌드로 이를 PASS 처리하지 않는다. 현재 Mac 앱·공통 제어·Company 확장 범위와
Binance 선물 실거래, 전체 자본·비용 대조, 금융 제어 및 무개입 CEO 자율 운용의 전체 인수는 별개다.
투자·운영 기록 미관측과 아직 구현되지 않은 동작은 남기며 앱 완성을 전체 투자 회사 완료라고 부르지 않는다.

## 2026-09-14 통합 설계 반영과 다음 구현

제품·회사 Git은 각각 main 하나를 기준으로 하며 개발 작업 사본, 격리 검증 환경, 실제 운영은
별도 수명과 권한을 가진다. 기존 제품 Git의 강제 checks/review/host lifecycle을 이 문서로
변경하거나 직접 main push를 허용하지 않는다. 작업 브랜치를 필수로 하는 회사 템플릿도 만들지 않는다.

| 구현 묶음 | 완료 조건 / 현재 남은 일 |
| --- | --- |
| 계약 | 환경 중립 Package, 독립 Verification, target/config/data-binding을 가진 보호된 선택/적용, exact ArtifactReference와 SDK 버전 계약 |
| 개발·검증 | 회사 비공개 repository binding, main 동시 통합 충돌 처리, 고정 입력 빌드와 disposable 시험, 후보가 변경할 수 없는 경계 검사 |
| 운영 적용 | 용도별 기존 admission/activation 재사용, hold 확보, 현재 revision 확인, 실제 readiness, 원래 intent 대조와 호환 복구 |
| 앱 | profile/config/package/deployment 로더 독립, GatewayWorkspace 조립 책임 분리, Settings에 source/test/active/observed 버전 연결 |
| Library | 최신 게시 한정 목록을 보존된 과거 버전 탐색으로 확장; 생성자와 게시자 구분, 검증·사용·보존 관계, 모든 대화/알림의 exact reference 유지 |
| 자율 운용·투자 | 실제 operating assignment/handover, 무개입 평가·다음 조건, 투자 Gateway/도메인/공급자 연결·경제 대조·독립 금융 제어 |
| 통합 인수 | 실제 Mac/격리 Linux/서비스 기록에서 오류·멈춤·재연결·권한 변경·복구와 잔여 의무 확인 |

전체 수락 기준은 [통합 인수표](../architecture/SYSTEM_DESIGN.md#10-acceptance-across-the-full-lifecycle)에
연결한다. 메뉴·샘플 화면이나 빌드 통과를 실제 투자 회사 완료로 표시하지 않는다. 새 main 메뉴나
별도 보고함은 추가하지 않고 기존 Library 상세와 Settings 탭에서 필요한 정보를 제공한다.

## 디자인 시스템 원본과 적용

사용자가 지정한 원본은 `openboa-ai/openboa-brand-system`이다. 2026-09-13에
원격 main을 확인했으며, 적용 기준은 release **2026.08.23**, commit
`e93f55cbfd90b668ef9d77875f71d8e53f7ceb4b`로 고정한다.
로컬 브랜드 checkout HEAD `e76ac503`은 이전 버전이므로 그대로 복사하지 않는다.
브랜드 저장소 자체나 그 작업 트리를 이 앱 작업에서 수정하지 않는다.

소비할 원본:

- `06-design-tokens/openboa.tokens.json`: `ref → sys → comp` 토큰, light/dark,
  서체·간격·배치·상태·데이터 색상·모션.
- `09-design-docs/OPENBOA-BRAND-TOKEN-SYSTEM-SPEC.md`: 최신 토큰 적용 계약.
- `07-component-guidelines/`: 버튼·입력·탐색·표·패널·에이전트 상태·승인·비상 제어 참조.
- `01-source-masters/`, `03-platform-icons/`, `USAGE.md`: 승인된 브랜드 자산과 사용 규칙.
- `08-fonts-licenses/`: 배포 서체·아이콘의 출처와 라이선스.

고정 원본 링크:
https://github.com/openboa-ai/openboa-brand-system/tree/e93f55cbfd90b668ef9d77875f71d8e53f7ceb4b

구현 원칙:

1. 지정 commit의 토큰과 필요한 자산을 출처·해시·라이선스와 함께 가져오고,
   앱의 CSS 변수와 타입으로 변환한다. 앱에서 색상표를 별도로 다시 작성하지 않는다.
   개발자 Mac의 sibling 경로를 런타임 의존성으로 만들지 않는다.
2. 제품 컴포넌트는 `sys`/`comp` 의미 토큰을 사용한다. 팔레트 숫자를 화면마다
   직접 선택하지 않는다. 누락된 별칭·순환 참조·잘못된 복합 값은 빌드 오류로 처리한다.
3. 제품 서체는 Martian Grotesk, Mona Sans는 승인된 아이덴티티 자산 전용이다.
   최신 브랜드에는 Pretendard가 포함되지 않는다. 한글은 Mac의 시스템 한글 폴백을
   제품 현지화 설정으로 두고 실제 줄높이·잘림·가독성을 확인한다.
4. Terracotta/Quiet Off-white/Blue Carbon 아이덴티티와 의미별 feedback/data 토큰을
   구분한다. 손익 부호와 금융 상태를 색만으로 표현하거나 손실을 시스템 오류와
   같은 의미로 취급하지 않는다. 테마에 맞는 데이터 토큰·범례·문구를 함께 쓴다.
5. 브랜드 패키지는 React 컴포넌트 라이브러리가 아니라 토큰·가이드·자산의 원본이다.
   앱에 필요한 React 컴포넌트는 그 기준으로 구현하고, 원본에 없는 동작은 앱 계약으로
   명시한다. 기본 제어와 확장 화면이 같은 컴포넌트를 소비한다.
6. Company 화면·서비스 기여는 허용된 배치·자료·의미 역할만 구성한다. 전역 테마,
   로고, 기본 제어 색상·서체·상태 의미를 덮어쓸 수 없다.
7. 2026-09-13 이전 초안의 임의 초록·금색 팔레트, 텍스트/링 마크, 수동 서체·간격 값은
   역사적 초안이다. 현재 앱은 위 고정 브랜드 원본을 소비한다. Ouroboros 제품명은 유지하되,
   새 제품 심볼을 승인된 OpenBoa 브랜드 자산인 것처럼 사용하지 않는다.

구현 검증은 토큰 해석·출처 확인과 실제 Mac 화면을 함께 사용한다. light/dark,
한글·숫자·표, 키보드 focus, 비활성·오류·경고·중단 확인 패널을 브랜드 참조와 대조한다.

## 컴포넌트 기반과 레이아웃 구현 전략

아래 비교는 **2026-09-13 도입 전 조사·설계 기록**이다. 당시 초안은 React/Vite/Tauri와 Lucide만
사용했고 shadcn, Base UI, Tailwind는 미도입이었다. 이후 선택한 **OpenBoa 토큰 + shadcn Mira의
Base UI 계열 + Tailwind CSS**를 현재 앱에 도입했다. 후보 라이브러리 비교나 제안된 표 구성을
현재 설치·사용 목록으로 인용하지 않는다. 실제 원본은 `apps/mac/src/ui`와 package/lockfile이다.
브랜드는 OpenBoa, 부품 라이브러리는 기본 상호작용과 재사용 가능한 구현을 담당한다.

[shadcn/ui](https://ui.shadcn.com/docs)는 컴포넌트 코드를 앱에 가져와 수정하는 방식이다.
[Base UI](https://base-ui.com/react/overview/quick-start) 기반 버튼·필드·탭·팝오버·다이얼로그를
필요한 만큼 가져오고, [CSS 변수](https://ui.shadcn.com/docs/theming)를 OpenBoa 의미 토큰에
연결한다. 기본 프리셋의 색·서체·radius·대시보드 배치를 제품 디자인으로 고정하지 않는다.
포커스·키보드·팝업 동작의 기본 구현을 재사용하되 실제 Mac 앱에서 검증한다.

표의 필터·정렬·선택은 [TanStack Table 구성](https://ui.shadcn.com/docs/components/base/data-table),
자본/성과 추이는 [Recharts 구성](https://ui.shadcn.com/docs/components/base/chart)을 활용한다.
금융 집계·단위·기간·현재 노출의 의미는 투자 모듈이 공급한다. 라이브러리가 숫자·차트의
경제적 정확성을 보증하거나 계산 기준을 정하는 것으로 취급하지 않는다.

대안으로 [Mantine](https://mantine.dev/) 같은 완성형 컴포넌트 묶음,
[React Aria](https://react-aria.adobe.com/) 기반의 조합도 가능하다. 이 앱은 이미 정해진
브랜드와 회장 관점의 전용 배치를 적용해야 하므로 수정 가능한 shadcn 기반을 우선한다.
같은 기본 상호작용을 여러 라이브러리 계열로 중복 구성하지 않는다. 정확한 버전과 가져온
컴포넌트 출처는 구현 시 호환성을 확인해 lockfile과 함께 기록한다.

### 재사용 단위

| 층 | 구성 예 | 설계 책임 |
| --- | --- | --- |
| 기본 부품 | Button, Field, Tabs, Dialog, Popover, Tooltip, Table | 브랜드 토큰, 크기·밀도·상태, 키보드·포커스 동작 |
| 공통 사용 패턴 | 앱 골격, 문맥 표시, 출처/시각/자료 상태, 목록→상세, 파일 미리보기, 대화 참조, 정확한 제어 확인 | 화면 사이 선택·복귀와 일관된 조작; 금융 의미나 계산을 소유하지 않음 |
| 목적별 화면 구성 | 자본/기간 결과, 변화 추이, 현재 노출, 회사 업무 행, 대화방 목록, 자료 목록 | 사용자의 질문에 맞는 우선순위·원본·행동을 조합; 투자 구성은 독립 모듈 안에 둠 |

컴포넌트마다 무엇을 보여주는지, 어떤 선택이 가능한지, 선택 후 어디로 가는지,
로딩·빈 값·오래된 관측·부분 자료·실패 시 무엇을 보여주는지를 함께 설계한다.
Metric/Card 같은 공통 부품에 손익·증거금의 계산을 넣거나 모든 자료를 같은 카드로 만들지 않는다.

### 배치와 밀도

투자·성과는 상단의 자본/기간 결과를 중심으로, 넓은 본문의 변화 추이와 보조 노출 요약,
짧은 CEO 설명, 실제 포지션/주문 행 순서로 구성한다. 큰 숫자·읽기 쉬운 행·그룹 간 여백으로
중요도를 구별하며 모든 영역을 동일 크기 카드로 채우지 않는다. 구체적인 간격·서체·테두리·
곡률은 고정 브랜드 토큰에서 선택하고 제품 배치에서 검토한다.

회사 운영은 우선 업무와 결과의 목록, 대화방은 방 목록과 메시지 본문, 자료실은 검색과
결과 목록/미리보기를 중심으로 각각 배치한다. 같은 부품을 쓰되 사용자 행동에 맞는 밀도를 갖는다.
1440×900에서는 주요/보조 영역을 병렬로, 1100×720에서는 보조 영역을 아래로 이동한다.
상세 패널이 열린 뒤 남는 본문 폭을 기준으로 재배치 또는 겹쳐 열기를 선택하며 숫자·단위를
작게 줄이지 않는다. 금융 표의 핵심 열은 남기고 보조 열은 상세에 둔다.

### 디자인에서 실행 화면까지

1. 투자·성과의 정보 배치와 핵심 조작을 시안으로 구체화한다. OpenBoa의 시각 규칙 안에서
   배치·밀도·상세 열기 방식이 회장 질문에 답하는지 확인한다.
2. 사용한 부품과 상태를 개발용 미리보기로 묶고, 정상·자료 없음·오래된 관측·미확정 결과가
   있는 투자·성과 화면으로 연결한다. 기존 앱을 유지하며 필요한 부품부터 도입한다.
3. 그 기준으로 회사 운영·대화방·자료실을 구성한다. 동일한 의미와 조작은 재사용하고,
   다른 정보 우선순위까지 같은 카드/격자로 강제하지 않는다.
4. 실제 Mac 앱에서 두 창 크기·테마·한글·긴 금액, 키보드 이동·Escape 한 단계 닫기·포커스 복귀,
   한글 입력 조합 중 Enter, 상세/대화 후 원래 투자 문맥 복귀를 확인하고 화면 증거를 남긴다.

당시 제품 앱과 별도로 [shadcn 기반 캘리브레이션](../../design/mac-calibration/README.md)을 만들고
시안 확정 전에는 제품 컴포넌트를 교체하지 않았다. 2026-09-14 승인 후 `apps/mac/src`로 원본을
통합했으며 현재 캘리브레이션은 그 앱 원본을 불러온다.

### 시각·조작 규칙까지 디자인 시스템으로 관리

브랜드 토큰 위에 [공통 시각·상호작용 규칙](../architecture/APPLICATION_SHELL_AND_VIEWS.md#product-visual-and-interaction-grammar)을 둔다.
색·서체·간격뿐 아니라 정보 위계, 숫자/차트/목록 표현, 상태, 선택·상세·복귀,
폼·제어와 접근성까지 같은 의미에는 같은 패턴을 사용한다. 화면 목적에 맞는 배치는 유지한다.

- 첫 화면은 자본과 기간 결과를 우선 읽고, 추이와 실제 입출금, 현재 노출로 이어진다.
  설명 카드나 동일한 KPI 카드 여러 개로 채우지 않는다.
- 포지션은 비교 가능한 행, 부분 체결은 체결/요청 수량, 업무는 담당자·행동·결과·다음 조건,
  자료는 파일 미리보기로 표현한다. 긴 해설은 상세나 대화에서 읽는다.
- 단위·시각·범위·미확정·제어 영향은 기본 화면에 남긴다. 필수 정보의 아이콘화나
  hover 전용 표시로 텍스트 수를 줄이지 않는다. 표·차트에 근거 없는 진행률/위험 점수도 넣지 않는다.
- 크기·간격·행 높이·아이콘·곡률의 공통 recipe와 정상/빈 값/지연/제한/처리 상태를
  개발용 컴포넌트 미리보기로 관리한다. 투자 의미는 투자 모듈이 공급한다.
- 실제 Mac에서 별도 설명 없이 투자 결과와 노출을 읽고, 근거→대화→원래 위치 복귀와
  올바른 제어 찾기가 가능한지 확인한다. 어려우면 안내문 추가보다 배치·표현·조작을 먼저 고친다.

## 회장이 원하는 정보와 행동에서 시작하는 화면 기획

**2026-09-13 4화면 시안의 설계 기록.** 아래 투자·성과 기본 진입과 회사 운영/대화방/자료실 묶음은
당시 정보 우선순위를 설명한다. 현재 경로·Home·Company 구분·Settings·Notifications는
[2026-09-14 체크포인트](#current-checkpoint)를 따른다. 사용자 질문·실제 근거·복귀 목적은 이어진다.

projection의 기준은 '어떤 백엔드 데이터가 있는가'가 아니라 '회장이 무엇을 알고 어떤
판단·행동을 하려는가'다. 공통/투자 도메인 분리는 코드·자료의 책임 경계이며, 화면에서
투자를 뒤로 배치하거나 모든 기능에 같은 비중을 줄 이유가 아니다. 첫 투자 회사에서는
투자 결과를 가장 잘 보이게 한다. 새 백엔드 기능·계산식을 이 기획에서 만들지는 않는다.

회장의 기본 흐름은 **맡긴 자본과 운용 결과 확인 → 변화의 이유와 실제 근거 확인 →
필요할 때 CEO와 논의하거나 위임·자본·운용 범위를 조정**이다. 매번 주문하거나 업무를
만들거나 모든 작업을 승인해야 하는 화면은 이 흐름에 맞지 않는다.

### 네 화면의 구분

| 메뉴 | 회장이 답을 얻으려는 질문 | 첫 화면의 우선 정보 | 주요 행동 |
| --- | --- | --- | --- |
| 투자·성과 | 자본과 결과가 어떤가? 이 상태로 계속 맡겨도 되는가? | 현재 자본/계좌 평가의 범위, 기간 결과와 비용, 실제 노출·미확정 효과, CEO의 현재 운용 설명 | 변동 원인 확인, 포지션/근거 선택, 맥락을 붙여 CEO에게 질문, 필요한 실제 제어 |
| 회사 운영 | CEO와 구성원이 지금 무엇을 위해 일하며 실제로 무엇을 만들었는가? | 우선 업무·기대 결과·진행 요약, 담당 구성원, 막힌 점, 최근 결과·비용·다음 조건 | 업무를 따라가기, 구성원/실행 근거 확인, 방향 논의, 필요 시 정확한 대상 제한 |
| 대화방 | 누구와 어떤 사안을 이야기하고 있는가? | CEO/개인/단체방의 참여자·주제, 연결된 투자/업무, 최근 메시지·미응답 맥락 | 기존 방에서 질문·보고·제안·의견, 자료 열기, 실제 결정이면 고정 제어 열기 |
| 자료실 | 판단의 근거와 만들어진 결과를 어디서 확인하는가? | 사용한 입력 자료와 보고서·코드·데이터, 관련 업무·작성자·버전·게시/검증 상태 | 검색·미리보기, 생성/사용 업무로 이동, 이전 버전 확인, 저장 |

이름만 바꾸는 것이 아니다. 기존 '현황'은 회사 운영의 설명으로, 실행·제어 이력은 회사
운영의 보조 보기로, 파일은 자료실로 옮긴다. 투자·성과는 기본 진입점으로 올린다.
기본 앱은 회사 운영·대화방·자료실을 제공하고, 투자·성과는 독립 투자/경제 모듈이 제공한다.
처음 연결을 마친 뒤에는 투자·성과가 열린다. 다시 돌아올 때는 진행 중이던 문맥을 보존한다.

### 투자·성과 — 첫 화면에서 무엇이 먼저 보여야 하는가

기본 1440×900에서 첫 화면의 중심을 투자 결과와 현재 노출에 둔다. 큰 시세 차트나
에이전트 실행 개수가 주인공이 되지 않는다. 작은 창에서도 다음 읽기 순서를 유지한다.

1. **어느 회사의 어느 돈을 보고 있는가.** 회사·실거래/테스트 환경, 계좌/회사 전체 범위,
   기간과 관측 시각을 먼저 식별한다. 중요한 예외가 있으면 대상과 영향을 한 줄로 알린다.
2. **얼마가 남았고, 무엇 때문에 변했는가.** 현재 자본/평가액과 기간 경제 결과를 가장 크게
   보여준다. 입출금과 투자 결과를 분리하고, 포함된 비용·미확정 비용은 바로 확인할 수 있게 한다.
   회사 순자본이 확보되지 않았다면 '연결 계좌 평가액 · 회사 전체 미집계'처럼 범위를 밝힌다.
3. **지금 무엇에 얼마나 노출돼 있는가.** 현재 포지션·미체결 주문·증거금과 설정된 제한,
   미확정 상태를 읽기 쉬운 행으로 보여준다. 관측하지 못한 값을 0이나 안전으로 표시하지 않는다.
4. **CEO는 왜 이렇게 운용하는가.** 현재 판단과 최근 변화, 다음 평가 조건을 짧게 보여주고
   작성 시각과 원본을 붙인다. 실제 거래 사실과 CEO의 해석은 별도로 읽힌다.
5. **내 판단이 필요한가.** 실제 결정이 있을 때만 정확한 대상과 근거를 보여준다. 필요하지
   않으면 억지 행동 버튼이나 보고 확인 절차를 만들지 않는다.

본문에는 자본/성과의 변화와 입출금 사건을 함께 읽는 추이, 현재 노출, 관련 운용 설명을
배치한다. 추이 자료가 없으면 가짜 곡선을 만들지 않는다. BTC 가격은 포지션의 문맥에서
보고, 전체 거래·자금 이동은 같은 화면의 '거래 내역' 보조 보기로 내려간다.
기간 선택은 손익·입출금·비용·추이에 적용한다. 포지션·미체결 주문·증거금·최근 CEO 판단은
'현재 상태 · 관측 시각'을 따로 표시하며, 과거 기간을 선택했다고 현재 노출을 과거 값처럼
보이지 않는다. 과거 시점의 포지션은 실제 자료가 있을 때만 별도 기준 시각으로 보여준다.

### 세 가지 핵심 사용 여정

| 상황 | 화면이 보여주는 정보와 조작 | 경험의 완료 조건 |
| --- | --- | --- |
| 평소 회사를 확인 | 투자·성과에서 자본/기간 결과·노출·중요한 미확정을 보고 CEO 운용 설명을 읽음 | 여러 메뉴를 돌거나 질문을 보내지 않고 맡긴 자본의 현재 상태와 확인할 일이 보임 |
| 자본이나 손익이 예상과 다름 | 해당 변동 선택 → 입출금·체결·비용·평가 변동 근거 → 필요할 때 판단·담당 업무·자료 확인 | 확인된 사실과 설명을 구분하고, 같은 계좌·기간으로 돌아와 결과를 다시 읽을 수 있음 |
| 설명을 듣거나 개입 필요 | 선택한 사안을 붙여 기존 CEO/그룹 대화로 이동하거나, 지원되는 정확한 제어를 열어 대상·영향 확인 | 문맥을 다시 입력하지 않고 전달하며, 실제 제어의 접수와 적용·남은 의무를 같은 자리에서 확인 |

### 회사 운영·대화방·자료실의 사용성

회사 운영은 아바타를 먼저 늘어놓기보다 회사의 우선 업무, 담당자, 기대 결과와 실제 변화를
함께 보여준다. 구성원 정체성은 각 업무와 연결된 이름·프로필에서 일관되게 드러낸다.
대기·중지·인계·활동 미관측 구성원도 찾을 수 있다. 과거 실행과 권한·제어·연결 변경의
전체 검색은 '활동 이력' 보조 보기에서 제공하며, Trace는 선택 후 펼친다.

대화방은 개인/그룹 형식보다 참여자와 주제가 먼저 보인다. CEO 개인방은 쉽게 찾고,
업무나 투자 상세에서 질문하면 관련 참조가 입력창에 보인다. 확인 클릭마다 새 방을
만들지 않는다. 보고·제안·진행 공유도 같은 메시지이며 별도 제출함은 없다.

자료실은 어떤 업무에 쓰이거나 어떤 결과로 만들어졌는지와 버전·상태가 먼저 보인다.
파일 미리보기가 기본 행동이고, 기술 식별자는 펼쳐 확인한다. 자료실에 들어가지 않아도
다른 화면의 파일 링크에서 같은 미리보기를 바로 열 수 있다.

### 화면을 오가도 판단 문맥을 잃지 않게 하기

- 어느 화면에서든 투자 모듈이 제공하는 간단한 자본/결과·중요 상태를 상단에서 확인할 수 있다.
  공통 앱은 이를 담는 틀만 제공하며 금융 숫자를 계산하지 않는다.
- 포지션→담당 업무→자료→대화로 가도 계좌·기간·선택 대상·읽던 위치를 유지한다.
  'BTCUSDT 포지션으로 돌아가기'처럼 출발 대상을 표시한다.
- 공통 상세 패널 하나에서 내용과 뒤로 가기 이력을 교체한다. 패널을 겹겹이 쌓지 않는다.
  긴 Trace·파일만 본문 안에서 넓혀 보며, 작은 창에서도 닫기·복귀·고정 제어는 남긴다.
- 연결·자원·Mac 설정은 하단 설정, 현재 위임·미결 결정·적용 중인 제어는 항상 보이는
  '위임·제어'에서 확인한다. 구체적인 투자·실행 동작은 관련 대상에서도 연결한다.
- 빈 값·오래된 값·접근 제한·미확정 효과는 서로 다른 설명을 갖는다. 투자 연결이 끊겨도
  그 사실을 투자·성과에 남기고 공통 관찰·대화·정지는 사용할 수 있게 한다.

사용성 확인에서는 회장이 첫 화면만으로 돈의 상태·현재 노출·중요 미확정을 설명할 수
있는지, 한 변동의 근거를 따라갔다 돌아올 수 있는지, 질문/개입에서 문맥을 다시 입력하지
않는지를 본다. 문서 검사나 예쁜 카드 배치만으로 이 기준을 통과했다고 보고하지 않는다.

## 하나의 대화 기능과 별도의 관찰 화면

소통은 '대화' 하나로 통일한다. 사용자와 CEO/다른 구성원의 개인방, 사용자와 여러
에이전트의 단체방, 에이전트끼리의 방 모두 같은 대화·참여자·메시지 기능을 사용한다.
보고, 진행 요약, 제안도 일반 메시지로 주고받고 긴 문서는 파일로 연결한다. 별도 보고함,
제출 양식·제출 식별자·제안 처리함은 만들지 않는다. CEO를 모든 소통의 필수 중개자로 두지 않는다.

회사 운영에서는 각 에이전트의 업무와 진행 요약을, 투자·성과에서는 투자 결과와 관련 운용 설명을 본다. 요약에서 관련 실행·산출물·원래 대화로 이동한다. 실제 관측과 에이전트의 설명을
구별하고 출처·시각을 표시한다. 요약은 기존 업무·관측·대화·자료를 보여주는 방식이며
새 보고 절차가 아니다. 화면을 열 때마다 모델을 호출하거나 새 메시지를 만들지 않는다.

에이전트는 사용자 질문 없이도 현재 권한 안에서 먼저 말할 수 있다. 메시지마다 모든
참여자를 깨우거나 답하도록 만들지 않는다. 일상 업무는 읽음이나 답변을 기다리지 않는다.
현재 상태·Trace·실행 정지·권한 결정은 기존 관찰/제어 기록으로 확인한다. 대화에서
동의했다는 문장만으로 권한을 변경하지 않는다. 기본 제어는 대화 기능과 독립적으로 동작한다.

내부는 기존 [통합 대화 계약](../architecture/CONTRACTS_AND_STATE.md#unified-rooms-and-proactive-messages)을
확장한다. 방 목록·참여자·수신 대상·답변 관계·고정 파일 참조와 미구현 전달/깨우기 경로를
연결하면 된다. 투자 대화도 같은 창구를 사용하며 금융 데이터와 제어의 의미는 투자 모듈에 둔다.

## 기본 컨트롤 플레인의 계약

- Core/Runtime/Gateway의 관측과 영수증을 조회한다. 에이전트 설명을 실제 상태로 취급하지 않는다.
- 실행 중지, 위임 철회, 새 활동 제한, 운영 종료의 정확한 대상과 현재 버전을 사용한다.
- 요청 키를 보존하고 요청/접수/적용/남은 의무를 나누어 표시한다.
- 재연결은 원래 요청을 조회한다. 새 주문·실행·중지 요청을 자동 제출하지 않는다.
- 투자 제한·주문 취소·포지션 정리는 투자 도메인 계약이다. 기본 제어는 해당 제어의
  가용성과 진행을 신뢰된 공통 패널에 표시하되, 일반 실행 중지로 대신하지 않는다.
- 도메인 서비스가 없거나 응답하지 않으면 금융 의무는 미확인이다. 실행이 종료됐다고
  남은 포지션·미체결 주문·비용이 없어졌다고 표시하지 않는다.
- 회사 에이전트는 앱 설치 파일·Rust 명령·고정 탐색·인증·권한 검사를 수정할 수 없다.
- 회사/도메인 렌더러는 독립된 오류 경계 안에서 실행한다. 프로필 로딩 실패도 별도 처리한다.
- 구성 크기·깊이·행·조회 동시성·갱신을 제한해 회사 화면이 기본 제어와 필수 조회의
  처리 여유를 소진하지 못하게 한다. React 오류 경계만으로 격리를 주장하지 않는다.

기본 제어 UI의 고정 여부는 편의가 아니라 경계다. 기본 경로와 메뉴는 회사 프로필에서
로드하지 않는다. 명령은 Rust allowlist와 서버의 현재 권한 검사로 제한한다.

## 구성 가능한 화면의 계약

**아래는 2026-09-13 계약 초안의 역사다.** 당시 에이전트 화면을 제외했던 결정은 현재 정책이 아니다.
현재는 [체크포인트](#current-checkpoint)와 [Company 코드·구성 계약](../architecture/APPLICATION_SHELL_AND_VIEWS.md#5-company-code-published-configuration-and-personal-home)에 따라
에이전트의 source/configuration 게시를 지원하고 실행 코드는 검토·검증 후 빌드한다. 고정 제어·신원·권한 보호는 유지한다.

첫 구현은 제품에 포함된 회사 템플릿·지원 구성과 제품 제공 컴포넌트를 사용한다. 임의 JavaScript,
React 코드, HTML, CSS, 외부 URL, SQL, shell, 인증 자료와 실행 명령은 허용하지 않는다.

프로필은 ID, revision, 회사/도메인 출처, 메뉴 목록, 레이아웃, 등록된 조회 키,
표시할 필드, 상세 참조를 지정한다. 제품 제공 구성 요소는 수치, 표, 시계열,
상태, 설명, 관계 목록이다. 조회가 반환한 출처·관측 시각·범위·누락 정보를 보존한다.
조회 키는 등록된 서버 조회에만 대응하며 입력은 해당 스키마로 검사한다.

제어 버튼은 화면 구성의 임의 명령이 아니다. 서버의 실제 제어 대상 참조를 기본
클라이언트가 해석하고, 고정된 확인 패널에서 현재 대상·버전·영향을 보여준다.
회사 프로필이 권한을 생성하거나 승인 상태를 작성하지 못한다.

초기 구성은 제품과 함께 버전을 관리한다. 예약된 시스템 영역, 조회 범위, 필수 의미
표시, 크기·수량 제한을 검사하고 잘못된 구성은 기본 화면으로 돌아간다. 회사 파일
게시를 화면 설치·활성화로 해석하지 않는다. 에이전트 기록 갱신은 화면의 자료만 갱신한다.

에이전트의 화면 생성·후보 게시·자동 활성화 기능은 만들지 않는다. 개발자의 제품/도메인
화면 변경과 에이전트의 콘텐츠 갱신은 다른 경로다. 표시 설정은 새 자료 접근·권한·제어를
추가하지 못한다.

## 코드와 데이터의 책임

아래는 초기 계획의 디렉터리 분리이며 **현재 파일 지도는 아니다**. 실제 경로는
[앱 Source ownership](../../apps/mac/README.md#source-ownership)과 현재 체크포인트를 따른다.

```
apps/mac/
  src/bootstrap/         기본 앱에 검증된 도메인 모듈을 등록하는 조립 지점
  src/ui-contracts/      도메인 중립적인 메뉴·참조·조회·공통 제어 패널 기여 계약
  src/design-system/     OpenBoa 토큰 변환 결과, 공통 컴포넌트, 출처·버전
  src/shell/             고정 앱 골격, 탐색, 실패 복구
  src/control-plane/     제품 소유 기본 화면과 제어 패널
  src/extensions/        모듈 기여 계약, 등록된 조회, 구성 검사
  src/company-views/     제품 기본 회사 템플릿, 지원 구성, 에이전트 자료 연결
  src/domain-modules/    필수 경제·선물투자 화면, 제품 소유 모듈 등록 계약
  src/data/              출처·revision·관측·요청 상태를 보존하는 클라이언트
  src-tauri/             인증, 고정 Gateway 호출, native 파일 선택·저장
```

이 목록은 이전 제품 내 도메인 모듈 구상을 보존한 역사다. 2026-09-15 목표에서 제품
bootstrap은 기본 기능과 generic Company Host만 조립한다. 현재 투자 화면·백엔드 원본은
별도 Company UI·서비스·어댑터 패키지로 이관할 대상이며, 실제 이동 완료를 뜻하지 않는다.
금융 타입·조회·계산·제어 의미는 Company가 소유하고 공통 Rust 클라이언트에는 넣지 않는다.
Company 패키지 없이 기본 앱이 빌드·실행되며 오류에도 Trace·파일·정지가 동작해야 한다.
앱에는 회사 원장 DB를 만들지 않는다. 표시 설정·선택 위치·접속 참조·미확정 요청
식별자만 로컬에 보존한다. 회사·도메인의 사실은 원래 서버 기록에 남는다.

수정된 목표 데이터 흐름:

```
기본 화면 ── 고정 Rust 호출 ── Gateway ── Core / Runtime / Resource 영수증
Company UI ── 고정 Host/SDK ── Gateway ── Company Service Host ── Company 서비스
Company 서비스 ── 제한된 host-call ── Gateway ── 공통 DB/Catalog 또는 보호된 전송 경로
```

제품에는 선물 계산이나 Binance 비즈니스 로직을 넣지 않는다. 투자 원장·효과 대조·한도와
거래소 변환은 Company 서비스·어댑터가 맡는다. 보호된 전송 경로는 선택된 서비스가 검증한
정확한 요청과 현재 권한·연결을 확인하고 인증·서명·전송을 맡는다.
회사 판단 내용은 Core DB로 복제하지 않는다. 공통 통제에 필요한 책임 배정/작성자
버전과 회사 기록의 실제 내용은 구별한다.

## 외부 레퍼런스에서 도출한 개선안 — 구현 전 검토

최우선은 사용자 요구로 명확해진 '회사와 구성원'의 일관성이다. 기본 앱과 내부 모두
논리 에이전트의 지속적인 정체성, 맡은 책임, 개별 실행, 실제 산출물을 구별해 연결한다.
[Company Agent Identity and Membership](../architecture/CONTRACTS_AND_STATE.md#company-agent-identity-and-membership)에
그 책임과 기존 principal/work/execution 계약의 관계를 보완했다. 아바타를 붙이는
표현 변경만으로 완료하지 않는다. 기본 화면은 제품이 제공하고 에이전트는 콘텐츠를 남긴다.

2026-09-13 Grok Bot/Build, Claude Managed Agents, Codex/OpenAI desktop, LangSmith의
공식 자료를 비교했다. 아래는 기존 화면을 개선하는 제안이며 제품 구현 완료나 새 권한
부여를 뜻하지 않는다. 기본 앱/투자 모듈 분리와 에이전트 화면 생성 제외를 유지한다.

| 우선순위 | 기존 설계에 더할 구체적인 동작 | 적용 화면 |
| --- | --- | --- |
| 제품 기준 | 지속적인 구성원 프로필·책임·현재 업무와 실행/산출물 이력을 연결; 책임 교체·인계 구별 | 현황·에이전트·공통 작성자 표시, 내부 identity/assignment 계약 |
| 우선 | 주의 필요/실제 결정/미확정 효과와 새 결과를 구분해 모으고, 읽음 상태와 문제 해결 상태를 분리 | 현황·공통 알림 |
| 우선 | 읽기 쉬운 실행 기록 ↔ 상세 Trace 전환; 같은 이벤트 선택 유지, 반복 호출 접기, 오류·관측 누락 보존 | 에이전트·실행 / Trace·이력 |
| 우선 | 실행 결과에서 파일 카드로 바로 미리보기; 실행 종료와 게시 미확인/게시됨/해당 revision 재조회 확인을 구별 | 실행 상세·아티팩트 |
| 우선 | 질문 입력창에 선택 실행/event/파일 revision 참조 칩 표시, 답변 근거에서 원래 기록으로 복귀 | CEO 대화·공통 상세 |
| 함께 보강 | 실행 당시 모델·설정·환경·instance와 현재 설정 구별; 목록의 최근 활동·대기 이유·다음 조건 표시 | 실행 목록·상세 |
| 도메인 | 계정·환경·계정 전체/BTCUSDT 범위·관측 시각 고정, 실행 정지 후에도 금융 미확정 결과 유지 | 투자 화면의 두 보기 |

Grok의 [attention list 사용 사례](https://x.ai/bot/guides/grok-bot-for-pms)는 소유자에게
필요한 것만 모으는 발상으로 참고한다. 기본 제품 메뉴로 확인한 것은 아니다.
[공식 101 가이드](https://x.ai/bot/guides/grok-bot-101#using-grok-bot)의 대화·Routine·실행
이력 공개 화면을 관찰했으며, [Build changelog](https://x.ai/build/changelog)는 짧은
실행 요약과 도구 호출 그룹화를 설명한다.
[팀 운영 가이드](https://x.ai/bot/guides/how-i-run-multiple-teams-of-grok-bots)의 구성원 명부와
기존 구성원 재사용을 참고하되, 작성자 예시의 인원 제한·승인 방식·외부 보드는 채택하지 않는다.
지속 구성원과 실제 책임·실행의 관계는 Ouroboros의 기존 권한 경계 안에서 구현한다.

Claude의 [Console 설명](https://claude.com/blog/building-with-claude-managed-agents),
[세션 파일 준비](https://platform.claude.com/docs/en/managed-agents/files#listing-and-downloading-session-files),
[저장 이벤트와 delta](https://platform.claude.com/docs/en/managed-agents/events-and-streaming#event-deltas)는
표시용 진행과 실제 보존 결과를 구별하는 근거다. Console 이미지 직접 접근은 브라우저
보안 정책으로 제한되어 픽셀 검증 없이 공식 기능 설명만 사용했다.

OpenAI의 [Activity](https://learn.chatgpt.com/docs/notifications#follow-chats-in-activity-view)와
[파일 선택 위치 피드백](https://learn.chatgpt.com/docs/artifacts-viewer#refine-files-with-annotations),
LangSmith의 [Trace 탐색](https://docs.langchain.com/langsmith/view-traces)을 참고한다.
이번에는 해당 로그인 앱을 직접 조작하지 않았다. 기능 문서 확인과 실제 UI 인수는 별개다.

새 화면 제작기, 고정 부서·인원수를 강요하는 조직도, 배포 Console, 미지원 steer/queue, 자동 재시도·모델 교체,
외부 Trace 서비스 연결은 추가하지 않는다. 네 가지 우선 개선은 단계 2~3의 조작 검증,
단계 4의 실제 기록 연결에 포함할 후보이며, 투자 개선은 단계 5의 독립 모듈 안에서 다룬다.
구현 시 누락된 조회는 서버 의존성으로 남기고 OpenBoa 디자인 시스템으로 표현한다.

## 구현 순서와 단계별 결과물

아래는 초기 의존성 순서와 인수 목표를 보존한 계획이다. 단계 번호나 당시 미구현 표현을 현재 진행률로
사용하지 않는다. 현재 공통 UI·Company 확장과 남은 자율 운용·실거래 경계는 최신 체크포인트와 실행 증거를 따른다.

### 0. OpenBoa 디자인 시스템 연결

고정한 브랜드 release에서 토큰·서체·필요 자산을 가져오고, 타입과 CSS 변수로 변환한다.
기본 버튼·입력·탭·표·패널·상태·승인·비상 제어 컴포넌트의 검토 화면을 만든다.
토큰 매핑, 허용 변형, 내용 규칙, 선택·키보드 동작과 상태 예시를 함께 관리한다.
현재 초안의 임의 디자인 값을 정리한 뒤 이 공통 컴포넌트로 앱을 구성한다.

통과: 최신 토큰 namespace와 출처를 확인하고, 양쪽 테마·한글 폴백·접근성 상태가
실제 Mac 화면에서 올바르게 표시된다. 브랜드 원본을 별도 디자인으로 대체하지 않는다.

### 1. 기본 앱과 도메인 모듈의 경계

현재 Tauri 앱에서 시스템 영역을 분리한다. 회사·도메인 프로필 없이도 실행되는
앱, 상시 제어 진입점, 최초 연결/재연결, 세부 패널, 독립된 실패 화면을 만든다.
회사 운영·대화방·자료실의 기본 세 화면과 투자·성과 모듈, 공통 상세·설정·위임 제어를 연결한다. 투자 우선 진입과 기본/도메인 의존성 분리를 동시에 확인한다. 공개 UI 기여 계약과
명령별 데이터·권한·서버 기록 연결표를 고정하고 금지 의존성을 검사한다.
구성원 identity/profile과 기존 principal·책임 배정·실행 이력을 연결하는 조회 의존성도
확인한다. UI 로컬 DB나 별도 에이전트 스케줄러를 만들지 않는다.

통과: 투자 모듈 없이 기본 앱이 동작하고, 선택적 구성 오류에도 기본 제어가 남는다.

### 2. 회장의 투자 확인·근거 탐색·논의 흐름

실행 목록/상세/이력, Trace 검색/필터/인과 관계, 아티팩트 탐색/미리보기/이전 revision,
선택 기록을 첨부한 CEO 대화를 연결한다. 투자 모듈은 계정·잔고/포지션·주문/거래이력의
같은 계정 범위와 관련 실행 참조를 제공하되 투자·성과와 거래 내역 보조 보기로 묶는다. 개발 자료임을 상시 표시한다.
투자·성과의 변동/노출에서 실제 효과·담당 업무·자료·원래 방으로 이동하고 돌아오는 흐름을 연결한다. 회사 운영의 진행 요약과 실제 실행도 연결한다.

통과: 생성 실행→도구 호출→게시 파일→CEO 질문까지 이동하고 돌아올 수 있다.
회장이 첫 화면에서 자본/기간 결과·노출·중요 미확정을 확인하고, 입출금과 손익을 구분하며 근거를 따라간 뒤 같은 투자 문맥으로 돌아올 수 있다.

### 3. 모든 UI 상태와 실제 Mac 조작 검증

개발 데이터임을 상시 표시한 상태에서 정상 운용, 조건 대기, 부분 체결, 미확정 결과,
권한 제한, 연결 단절, 책임 인계, 빈 회사, 프로필 손상을 재현한다.
빈 대화방, 수신자 부재, 진행 요약의 갱신, 자료 누락, 읽지 않은 메시지와 적용 중인 제어도 구별한다.
1440×900/1100×720, 시스템 테마, 키보드 탐색, 상세 복귀와 대화 참조를 확인한다.

통과: 0/자료 없음, 접수/적용, 저장/게시, 설명/영수증을 혼동하지 않는다.
실제 Mac 앱 화면 증거를 남긴다. 이 단계는 실제 투자 검증으로 보고하지 않는다.

### 4. 기본 제어의 실제 Gateway 연결

인증된 조회로 작업·실행·예약·권한·자원·이벤트를 연결한다. 부족한 목록/관계 조회는
기존 권한 경계 안에서 구현한다. native terminal 이벤트와 종료·반환을 함께 읽는다.
아티팩트 게시 revision의 재조회와 실제 대화 저장·전달·답변을 연결한다.
개인방·단체방·에이전트 간 대화에서 인증된 구성원이 먼저 말하고, 실제 수신자에게 전달되는
경로를 연결한다. 방 목록·고정 파일 참조·읽음 표시·대기 중 수신자 깨우기와 배정/실행 교체
라우팅의 구현 누락을 해소한다. 관찰 요약은 같은 실제 업무·관측·대화 자료를 참조한다.
격리 테스트 실행에 중지를 요청하고, 적용·자원 반환을 독립 관측한다.

통과: 잘못된 신원/철회된 권한/오래된 버전이 거절되고, 연결 단절 뒤 기존 요청
식별자로 복구하며, 회사 UI와 무관하게 실행을 제어할 수 있다.

### 5. 투자 모듈의 실제 기록 연결

투자 도메인은 Binance BTCUSDT 계약·시장 관측과 계좌·잔고·포지션·주문·체결·비용
기록을 연결한다. 읽기·재조회·대조를 먼저 성립시키고 미관측 범위를 표시한다.
실제 주문 관련 제어는 금융 도메인의 검증 및 현재 운영 설정에 따라 제공한다.

통과: 포지션↔판단↔주문↔체결↔비용을 원본 참조로 이동하고, 부분 범위/오래된
데이터/미확정 효과를 표시한다. 미연결 기능은 삭제하거나 성공으로 꾸미지 않는다.

### 6. Mac 사용 흐름 통합

처음 연결, 기존 회사 재연결, 앱 닫기·재실행, 절전·인증 만료·재연결,
회사 구성 오류, 제한·종료를 통합 검증한다.
UI 종료와 운영 종료를 분리하고 회사 데이터는 기본 보존한다.

통과: 실행 가능한 .app, 실행 방법, 기본 제어와 프로필 계약, 실제/합성/미실행
검증 결과, 남은 서버 의존성을 함께 제공한다.

## 우선 납품 및 전체 제품 완료의 구분

첫 검토 결과물은 단계 0~3의 실제 Mac 앱이다. OpenBoa 디자인 시스템을 적용한
고정 제어 영역과 회사·투자 화면의
구분 및 기본 조작을 먼저 직접 확인한다. 이후 단계 4~6을 같은 앱에 연결한다.

UI 앱 완료는 실제 기본 제어와 기록 조회가 연결된 상태까지다. 회사의 완전한 자율
운용·실제 금융 제어·경제 결과 검증은 기존 전체 제품의 완료 기준이며, UI 작업에서
없애거나 개발 데이터로 대체하지 않는다.

## 이전 작업 체크포인트와 시안 이력

아래는 2026-09-13부터의 순차 기록이다. 각 항목의 “현재/최신/미구현/미실행”은 그 시점의 상태를
가리킨다. 지금의 구현 상태는 문서 앞의 [2026-09-14 체크포인트](#current-checkpoint)를 기준으로 판단한다.

- 브랜치: codex/mac-owner-app. 검증한 main base: 4429c4a.
- 기존 검증 기반 codex/basic-flow-demo의 11개 커밋(defd039까지)을 fast-forward로 포함.
- Tauri / React 초안과 일곱 화면, 개발 상태 데이터, Rust 고정 명령 초안 작성.
- 프론트엔드 production build 및 macOS debug .app 번들 빌드 성공.
- 실제 Mac 앱의 초기 연결 화면 관측. 나머지 화면 전체 인수는 아직 미실행.
- 기본 컨트롤 플레인/선언형 프로필 분리 초안 작성; 기존 App과 통합 전.
- 투자 도메인 자료형·원장·Binance 프로토콜 초안 추가. 프로토콜 단위 검사 3개 통과.
  Gateway/custody 연결, 금융 한도·원장 전체 검증과 실제 계좌/주문 실행은 미실행.
- 서버 제품 코드는 아직 수정하지 않았다. 새 company API는 클라이언트 계약 초안이며
  실제 서버 구현이 완료된 경로가 아니다.
- 2026-09-13 사용자의 최신 요청에 따라 추가 제품 구현을 멈추고 이 UI 계획을 정리했다.
- 이어진 화면 하위 아키텍처 요청에 따라 UI 책임, 모듈 기여 경로, 화면/기록 연결,
  제어·활성화·실패 계약을 별도 하위 설계로 작성하고 상위 아키텍처·콘솔 설계에 연결했다.
- 최신 요구에 맞춰 기본 관찰·추적·아티팩트·정지·대화와 투자 잔고·상태·이력을
  독립 UI 모듈로 분리했다. 에이전트의 화면 생성은 보류 항목이 아니라 설계 범위에서 제외했다.
- 회사 구성원의 정체성·책임·실행 분리와 구성원 기준 화면을 내부 계약과 연결했다.
  후속 요구로 역할명 기반 증원이 아닌 실제 업무 효율에 따른 자율 배치·통합을 명시했다.
  별도의 HR/채용 승인 절차나 기본 관리·금융 기록의 에이전트 의존성은 추가하지 않는다.
- 최신 사용자 수정에 따라 별도 보고·제안함과 제출 계약을 제거했다. 개인방·단체방·에이전트 간
  소통을 기존 대화로 통합하고, 현재 활동과 진행 요약은 관찰 화면에서 제공하도록 정리했다.
  해당 서버/UI 연결은 미완료이며 제품 코드 수정 없이 설계만 변경했다.
- 회장 관점의 정보·행동을 기준으로 투자·성과(기본 진입), 회사 운영, 대화방, 자료실을 기획했다.
  투자 결과→변화 근거→CEO 논의/위임·개입 흐름, 문맥 보존과 돌아가기, 첫 화면 우선순위를
  구체화했다. 이름 변경만으로 대체하지 않으며 공통/도메인 코드는 계속 분리한다.
- 실제 화면의 사용성·접근성·회장 관점 조작 검증은 아직 수행하지 않았다. 이번 변경은 화면 기획이며 백엔드 기능·공유 상태 계약을 추가하지 않았다.
- 후속 요구에 따라 디자인 시스템에 숫자·추이·행·파일 미리보기 중심의 시각 문법,
  공통 크기·밀도·상태·선택/복귀·제어 규칙과 설명 없는 사용성 확인 기준을 추가했다.
  해당 화면/컴포넌트는 아직 구현하지 않았으며 제품 코드·백엔드 계약은 변경하지 않았다.
- 회장 관점 기획의 독립 문서 검토와 문서 무결성 검사 PASS (문서 19개, 링크 338개).
  계획의 상대 링크·표·공백·코드 블록 검사도 PASS. 실제 UI 사용성 검증의 증거는 아니다.
- 공개 PR/배포/실거래/추가 모델 호출 없음. 기존 및 무관한 작업은 보존.
- 사용자 피드백에 따라 섹션 구분선을 제거하고 여백·정렬·배경으로 구분하는 시안을 만들었다.
  공식 shadcn/create Mira(Base UI) 컴포넌트와 OpenBoa의 8개 완전한 글자 역할을 적용했다.
  `design/mac-calibration`에서 투자 시안·컴포넌트 상태·타이포그래피를 직접 비교한다.
  이는 디자인 캘리브레이션이며 실제 앱·서버 구현 완료를 뜻하지 않는다.

### 요소별 목적 계약과 현재 시안 감사

사용자의 “모든 화면·레이아웃·요소의 목적을 명시” 요구를
[UI_PURPOSE_CONTRACT](../design/UI_PURPOSE_CONTRACT.md)에 구체화했다.
Portfolio, Company, Conversations, Library와 고정 Shell·상세·제어·연결·초기 연결에
목적/사용자 질문, 원본 근거, 배치 이유, 행동·복귀, 상태, 검증 기준을 연결했다.
현재 시안 composition의 `UX:` 주석은 같은 요소 ID를 가리킨다.

실제 브라우저에서 투자 개요→기간 선택→포지션 상세→CEO 대화→고정 제어를 확인했다.
목적 감사와 화면 증거 (retained local evidence; excluded from product Git)에
금액 구성 근거 부재, 열리지 않는 산출물, 주문 상세 부재, 고정 대화 문맥과 제어 미구현을 남겼다.
이는 실제 금융 제어 검증이 아니며 캘리브레이션의 합성 자료와 상호작용만 확인한 것이다.

이번 변경은 목적 문서·연결·주석이다. 시각 재설계, 실제 네 화면의 전환과 서버 연결은 다음 구현에 남는다.
이전의 빌드·레이아웃 검사는 시안의 기술적 검증이며 사용자 목적 충족이나 최종 시안 승인으로 보지 않는다.

### 2026-09-13 · 목적 계약에 따른 시안 03 재설계

사용자의 “재설계 진행”에 따라 `design/mac-calibration`의 네 주 화면과 공통 상세를 구현했다.
Portfolio는 현재 자본·기간 결과·현재 노출·남은 주문을 우선 배치한다. 금액 구성 근거,
관측점, 포지션→주문→판단→정확한 파일 버전과 CEO 대화→원래 자료 복귀가 연결된다.
Company는 지속 구성원, 업무, 실행, 공개 도구 Trace를 구분한다. Conversations는 개인/단체방,
선택 문맥, 방별 초안, 로컬 저장 상태를 제공한다. Library는 작성자·업무·고정 revision으로 자료를 탐색한다.
주요 composition의 `UX:` 주석과 [목적 계약의 현재 범위](../design/UI_PURPOSE_CONTRACT.md#coverage)를 함께 유지한다.

OpenBoa/shadcn의 기존 토큰·부품을 유지하고 섹션은 선 대신 여백·정렬·배경으로 구분했다.
고정 Owner controls/Connections는 투자 화면 밖에 유지하며, 제어는 정확한 대상 검토까지만 가능한 시안이다.
브라우저에서 네 화면, 자료/대화 왕복, Trace→실행 정지 검토, 1D/7D, 미확정/제한/빈/지연 상태,
1440×900·1100×720, 밝은·어두운 테마를 확인했다. 빌드·scoped lint·브랜드 원본 검사가 통과했다.
화면 증거와 검증 한계 (retained local evidence; excluded from product Git)를 보존했다.

`apps/mac`, 제품 서버 및 투자 백엔드는 이번 재설계에서 변경하지 않았다. 실제 서비스/금융 제어,
서버 대화 전달, 전체 이력·revision 비교, 초기 연결·복구는 제품 구현에 남는다. 브라우저의 파일
저장 완료는 관측되지 않아 미검증으로 기록했다. 현재 결과는 사용자 검토용 시안이며 최종 디자인 승인이나
실제 앱 완료가 아니다. 공개 PR·배포·실거래·추가 모델 호출은 수행하지 않았다.


### 2026-09-14 · 승인한 시안을 재사용 가능한 Mac UI로 이식

사용자의 “좋아 이걸로 앱 구현” 요청으로 시안 승인을 확인했다. `apps/mac/src`를 유일한
원본으로 두고 OpenBoa 토큰 → 실제 shadcn 부품 → 의미별 공통 컴포넌트 → 공통 레이아웃 →
화면으로 분리했다. `design/mac-calibration`은 같은 원본을 불러오는 개발 도구가 됐다.
투자는 `domains/investment`, 회사·대화·자료는 공통 feature로 분리했다. 연결과 소유자 제어는
고정 shell에 남으며, 의존성·임의 typography 검사가 앱 빌드에 포함된다.

상세/복귀 reducer, feature 오류 격리, source 전환 시 state 분리, 명시적인 샘플 진입,
기존 Gateway DTO의 별도 readout adapter, native 파일 저장 port를 구현했다.
기존 실제 API 호출 계약과 원래 요청 키 재조회 경로를 보존한다. 연결 실패를 샘플로 대체하지 않는다.

[앱 실행 방법](../../apps/mac/README.md), [계층별 구현 계약](../design/UI_IMPLEMENTATION.md),
검증과 화면 증거(제품 checkout 밖 비공개 보존 자료)를 남겼다.
전체 lint·UI 경계 검사, TypeScript/Vite, Vitest 24개, Rust 저장 검증 3개,
Tauri debug `.app` 번들 및 로컬 ad-hoc 서명 검증이 통과했다. 실제 빌드의 네 화면,
Trace→실행, 자료→CEO 대화→정확한 revision 복귀, 두 테마와 최소 크기를 브라우저에서 확인했다.

Mac이 잠겨 있어 실제 native 창·저장 창·닫기/다시 열기는 미검증이다. 기존 `/company/*`는
서버 구현이 확인되지 않은 계약이며, 새로운 전체 투자 projection과 실제 대화 전달도 남는다.
이번 결과는 Mac 클라이언트 UI 구현·빌드이며 자율 투자 회사 전체의 완료가 아니다.
실거래·추가 모델 호출·실제 회사 제어·공개 배포·PR은 수행하지 않았다.


### 2026-09-14 · 나머지 화면과 상세 흐름 구현

“다른 화면도 이제 다 만들어” 요청에 따라 기존 네 주 화면을 유지하면서 Company 이력,
대화방 안 검색, Library의 현재/이전 publication 탐색, 연결·실행 자원·저장 공간 목록과 상세,
일곱 범위의 소유자 제어 검토, 현재 위임/요청 이력, 공통 앱 설정, 기존/복구 연결 진입을 추가했다.
새 타임라인과 상세 섹션은 공통 부품이고 탭·검색어·고정 revision 복귀는 같은 탐색 상태를 사용한다.

기존 샘플의 지연 상태에서 publication 본문 시간을 바꾸던 동작을 제거했다. 없는 revision은
최신 파일로 대체하지 않는다. 제어의 로컬 검토와 실제 요청·접수·적용도 구분한다.
실제 서버 projection, 계정 연결, 메시지 전달이나 거래 실행 구현으로 간주하지 않는다.
Mac 잠금 상태가 계속되어 native 실행 검증은 미완료이며, 최종 빌드의 브라우저 검증 범위는
화면 증거(제품 checkout 밖 비공개 보존 자료)에 기록한다.

### 2026-09-14 — quality repair after owner rejection

Replaced repeated/nested collection cards with shared row navigation and timeline-title actions; grouped financial and control-plane actions; repaired conversation height allocation and reduced repeated sample copy. Canonical type tokens remain unchanged. See current audit and screenshots(제품 checkout 밖 비공개 보존 자료). Existing 27 tests, lint, UI boundaries, production and Tauri debug builds, and ad-hoc signature checks pass. Overall visual acceptance and native runtime verification remain outstanding.


## 2026-09-15 — App/runtime connection implementation checkpoint

This is a partial code checkpoint for the first basic-flow bundle, not completion of the
full app/runtime plan or a live resource-smoke pass.

Implemented in the protected product paths:

- Core `GET /intents/by-request-key?operation=…&request_key=…` resolves the authenticated
  principal's original request with current inspection permission. It does not replay an
  operation, expose protected input, or treat a missing record as a completed effect.
  Gateway admits only this GET query shape; the native stop-recovery path now uses it.
- `GET /workspaces/{workspace}/publications/{intent}` resolves historical publication metadata
  through the existing Gateway resource boundary. Core checks the current work, target,
  namespace and physical storage generation, validates the stored Catalog receipt, and
  reports the exact immutable revision and files. The publication inspector resolves that
  reference instead of substituting the newest manifest. Retired or inaccessible material
  is not presented as a readable current file.
- Native connection generations fence stop commands, message storage/delivery and original
  request lookup after profile replacement. This generation is independent of the persisted
  request key, so reconnecting does not generate a replacement stop request.
- Notification navigation chooses its category's primary record: a stop notification opens
  the control request even when the same source also contains an execution ID.

Verification of this checkpoint:

| Check | Result |
|---|---|
| React/TypeScript build and UI/Company import boundaries | PASS |
| App Vitest suite | PASS — 95 cases |
| Gateway tests including real local HTTP forwarding | PASS — 30 cases |
| Native Rust tests | PASS — 10 cases; explicit Gateway fixture case NOT RUN |
| Native executable build | PASS |
| Core executable compile; notifications/workspace PostgreSQL test compilation | PASS |
| Actual PostgreSQL execution and API contract drivers | NOT RUN — explicit disposable environment/config missing |
| Actual model MCP/DB/publication/resource-return run | NOT RUN — disposable Linux environment and authorized credential input unavailable |
| Native screen inspection | NOT RUN — Mac locked |

The first Gateway test attempt could not open local fixture sockets inside the sandbox;
its subsequent local-server run passed. An intermediate TypeScript variable-reference error
was corrected before the passing production build. Compilation is not SQL execution or UI
observation, and the additional PostgreSQL cases remain unverified until run on the fixture.

Remaining prerequisite implementation: replace the URL-derived environment identifier with
an authoritative environment/store incarnation; enforce the full environment/principal/
selection binding at the server's effect boundary; extend freshness fencing to all resource
mutations and owner commands. Native profile generation alone does not detect a server
replaced behind an unchanged URL. Resource-smoke must then be observed from the real Mac app.
Persistent Runtime service mode, caller/service contexts, protected Auth Module host,
Company lifecycle and Binance-specific implementation remain later work in the accepted plan.


## 2026-09-15 — Authoritative owner connection binding

Implemented the next prerequisite of the basic app/runtime bundle:

- Migration `0033_environment_identity.sql` assigns a stable random environment ID to firm data.
  `/conditions` returns the authenticated human's `OwnerBinding`: environment, firm, principal,
  and current Core serving generation. Runtime instances keep their bridge identity and do not
  receive an owner binding. This adds no operating authority or runtime-readiness claim.
- The native client pins that binding on initial observation. Subsequent management, DB and
  Catalog requests carry it; an old server generation cannot be silently replaced during refresh.
  Core validates the binding inside its existing transaction lock before request replay,
  reservation or admission. Gateway still derives identity from mTLS, rejects ambiguous binding
  headers, and refuses an owner binding from an instance. Raw input remains protected.
- Native connection generations now guard Catalog IPC reads/mutations, artifact preview/save,
  record/message reads, notification reads/acknowledgments and Company package preparation as
  well as controls and message delivery. Company configuration transports capture their native
  generation separately from persisted request identity.
- `Use saved connection` explicitly reopens the saved native profile, establishes a new pinned
  binding and clears obsolete Company views. Background refresh does not do this. The stable
  environment/principal request namespace survives an ordinary Core restart; original keys can
  then be read without submitting a replacement request.
- Fixed the previously missing Tauri manifest/capability entry for `catalog_publication`.
  The build boundary check now rejects a handler absent from the command manifest or any
  capability. Saved reconnection and publication lookup are restricted to the owner WebView.

Final verification on newly created disposable PostgreSQL 18.6 clusters:

| Check | Result |
|---|---|
| Core PostgreSQL tests | PASS — 82, including stale environment/firm/principal/server rejection before effects or replay, stable environment across restart, current-scope original request lookup and historical publication revision |
| Actual mTLS Core/Gateway/CLI API | PASS — wrong bindings rejected; restarting the owned services preserves environment and original intent but rejects the old generation |
| Actual DB/Catalog/Gateway resource API | PASS — bound DB read/write and file transfer; rejected bindings create no resource admission; original receipt/revision recovery, binary, storage failure, namespace, retirement and collection cases |
| Gateway Rust tests | PASS — 32 |
| React tests and native tests | PASS — 95 and 11; one explicit real-agent Gateway fixture test remains NOT RUN |
| TypeScript, UI/Company boundaries, production frontend and native executable builds | PASS |
| Fixture cleanup | PASS — PostgreSQL clean shutdown and owned child groups verified |
| Native screen interaction | NOT RUN — Mac lock confirmed by the UI tool |
| Real Codex resource-smoke | NOT RUN — separate explicit Linux/model fixture still required |

PostgreSQL tools were built in private temporary storage from the official 18.6 source and its
verified SHA-256. No existing database, company account or personal runtime was adopted. The
first API fixture failed because the default macOS `openssl` lacked its required key algorithm;
its logs and successful cleanup were retained. Selecting the installed OpenSSL binary produced
passing runs. Source, logs and safe aggregate verification evidence remain outside product Git.

Limits: this implements owner environment binding, not the complete Company service/root-effect
contract. Legacy CLI calls may omit the additive precondition; the native app requires it. An
offline restore must restart Core, and the full Company service/package/schema selection binding
is still pending. Old URL-hash local references remain retained rather than being automatically
reinterpreted as belonging to another store. Next implementation remains persistent Runtime,
service caller contexts and the protected Auth Module host. No provider call, live trading,
production activation or public delivery is claimed by this checkpoint.

## 2026-09-15 — Persistent Runtime supervisor and original claim continuity

Implemented the persistent supervisor part of the next app/runtime milestone. The continuing
process waits for already admitted executions; each private execution retains its own finite
profile, authority, capacity reservation and deadline. No company work is created by the worker.

- Added explicit `--service` mode with bounded polling and independent managed-guard enforcement.
  Empty queues and fixture execution counts do not end the service. Existing one-execution,
  bounded-worker and explicit reconciliation modes remain separate. The service renderer accepts
  a distinct worker configuration, keeps `Restart=no`, memory/task limits and graceful-stop
  settings, and removes only the supervisor's fixture lifetime in service mode.
- Added read-only `GET /runtime/claims/{intent_id}` under the authenticated Runtime service
  boundary. It exposes the exact original assignment and compute-return status. A different worker
  cannot inspect a claimed record. Revocation does not erase the assigned observer's recovery view.
- Runtime reads and pins the server's environment, firm, serving generation, worker, original
  intent/execution and profile before claiming. Core compares this precondition inside the claim
  transaction, before attempts or effects. Matching metadata is not identity or new authority.
- The protected slot persists and syncs its pending claim before sending. Response loss and crash
  retain that barrier. Resolution archives the original observation and clears the barrier only
  when Core confirms the exact assignment terminated and capacity returned. Service startup also
  checks retained earlier instance journals. A new process does not reset an unresolved attempt.
- `--inspect-claim` reads the original record without retry. Existing stop-only reconciliation
  can release a matching barrier after qualified compute return. Unclaimed/ambiguous and pre-binding
  failures without enough evidence stay blocked for explicit recovery. External obligations remain
  independent of returned compute capacity.

Verification for this checkpoint:

| Check | Result |
|---|---|
| Core PostgreSQL contracts | PASS — 82; added actual transaction assertions for all seven claim-context fields, wrong worker, restart, termination without return, original assignment and one-time return |
| Actual mTLS Core/Gateway/CLI API | PASS — service authentication, negative preconditions, stale generation, original claim, denied repeated claim and read-only recovery after revocation |
| Runtime Rust invariants | PASS — 33, including persistent waiting, more than the fixture count, stop, no retry on uncertain error, durable pending records, malformed/aliased records and program-journal size |
| CLI and service renderer tests | PASS — 32; persistent mode retains managed guard, resource bounds, explicit stop and no automatic restart |
| Shared contract tests | PASS — 6 |
| Native suite and catalog tooling | PASS — 34 and 15; `native.persistent-worker` is registered with its managed-guard prerequisite |
| Affected-crate Clippy and scoped formatting | PASS |
| Linux ARM64 Runtime compilation | PASS — all targets checked with the matching official Rust compiler/standard libraries and Zig in private temporary storage |
| Core/Gateway/CLI executable builds | PASS |
| Disposable database/process cleanup | PASS — both runs confirmed child-group cleanup and PostgreSQL shutdown; no existing database or VM used |
| Actual persistent Linux execution / installed unit / real Codex resource-smoke | NOT RUN — requires the separately selected disposable native environment |

The first local socket tests required the normal test-network sandbox permission. The first
cross-compile attempt exposed the Homebrew/official Rust build-identity mismatch; matching official
tools and the target-specific compiler wrapper resolved it. Downloads were checksum-verified and
installed only in private temporary storage. Earlier failed attempts and final evidence are retained
outside product Git. Cross-compilation is not Linux containment or running-service proof.

This checkpoint does **not** implement Company service invocation scopes or its desired-service
controller. Next: server-established effective caller/service contexts and deterministic root/child
effects, followed by the separately qualified Auth Module host. The original caller's authority,
selected operation's effect limits and the service's current authority must all constrain a child
request; the claim precondition implemented here is not a substitute for that contract. Reserved
dependency capacity, automatic Company responsibility continuity, native app integration and the
real-model acceptance run remain explicit work in the accepted plan. No operating activation,
provider request, trading, installed service or public delivery occurred in this checkpoint.


## 2026-09-15 — Company operation scope and attributable direct child effects

Implemented the next direct-call boundary over existing adapter qualification, Core executions,
Gateway resources and Runtime identities. No Company business logic, owner identity or company data
was added to product source; no new worker, UI renderer or authority service was introduced.

- A submitted program can declare one operation with at most 32 deterministic effect slots. Each
  fixes target, resource operation, payload bound and optional required input values. Registered
  target/worker/configuration snapshots are frozen with the submission; qualification and activation
  cover that exact plan. An operation name alone has no permission or read/write semantics.
- Invocation requires the selected operation and bounded input. Core records the root intent,
  original caller/work/grant/instance/generation and immutable environment/selection/program/plan
  binding. Actual service identity comes from the admitted execution and authenticated Runtime.
- Gateway carries a slot name, never an effective-caller/root identity supplied by Company code.
  Core derives the root from the actual instance. A unique root/slot maps to one child and input
  fingerprint in the same transaction as its existing resource reservation. Different transport
  keys replay that same child; changed input conflicts; an undeclared slot cannot expand the budget.
- Admission, dispatch and result access preserve both current caller and service scope, target
  bindings and selected adapter. Caller exit keeps provenance; grant/work-control withdrawal or
  selection change blocks child use. Each child retains its own original claiming worker/attempt.
- Scoped services cannot use management APIs to spawn unscoped executions, submit adapters or nest
  invocations. Their resource receipt access is confined to their own children and exact admitted
  program inputs. Native materialization continues through its existing fixed-input path.
- `execution_self` exposes the service's own operation input and plan; execution observations expose
  safe root/caller/assignment/child metadata without protected configuration or another call's input.
  Child-binding events carry their actual work scope. Root response and compute termination remain
  separate from effect settlement. Owner inspection works after selection stop without resubmission.
- Existing adapter payloads remain compatible. DB Gateway requests can select a registered target,
  preserving the existing default. Scoped slots initially support DB reads/writes, Catalog file
  reads/uploads/publication and model resource calls. No live call was made to a model or exchange.

Verification uses disposable PostgreSQL and local services with synthetic qualification/Runtime
observations. The tests cover human and agent origins, original-caller exit, each grant chain,
removed owner work control, unknown/changed slots, changed inputs, concurrent replay, sole attempts,
read-to-write escalation, management escape, receipt isolation, immutable records, Core restart,
selection stop, managed MCP invocation and explicit permitted writes. Actual Linux containment or
a running Company program is not inferred from these SQL observations.

Final verification on the final source and rebuilt binaries:

| Check | Result |
|---|---|
| Core PostgreSQL contracts | PASS — 87, including five new direct-service scenarios |
| Gateway tests | PASS — 34, including slot validation, selected DB target and authenticated identity forwarding |
| Shared contracts / Runtime invariants | PASS — 7 / 33 |
| Actual mTLS Core/Gateway/DB/Catalog/CLI | PASS — unbound/spoofed slots create no effects; reads, writes, exact file publication/retrieval, receipt recovery and all-service restart remain verified |
| Core service-test and affected-crate Clippy | PASS — warnings denied |
| Scoped Rust formatting / diff checks | PASS |
| Core/Gateway/Resources/CLI executable builds | PASS |
| Disposable databases and child processes | PASS — runner confirmed shutdown and cleanup; existing databases were not accessed |
| Actual Linux Company execution / persistent Company controller / real Codex | NOT RUN |

The earlier fixture run was correctly denied because its helper omitted `runtime_release`; adding
that existing release step fixed the fixture without weakening the product gate. Earlier results
and failures are retained outside source Git. Company service execution is proven here at the SQL
contract boundary with synthetic Runtime identity/qualification evidence. The mTLS resource suite
proves actual transport, DB and Catalog behavior plus forged-slot rejection; it does not claim a
contained Company program executed. Source snapshots, a scoped patch and verification summary are
retained with this task's private evidence. Nothing was installed into an existing operating service.

Remaining in the accepted plan: desired-service management, nested calls and independent service
grants, dependency capacity, complete schema-bound Company operations and the protected Auth Module
host, followed by native app/Linux/model integration. This checkpoint completes the direct
operation-scope and root/child resource boundary; it does not claim the full Company runtime or app
is ready to operate. No production activation, trading, provider request or public release occurred.


## 2026-09-15 — Durable finite Company call continuation

Implemented explicit restart authority for one already admitted Company operation. This is the
recovery part of the persistent-service work, preserving the existing root/effect contract rather
than creating another business invocation after a process exits. It changes generic product runtime
code only; no private Company package, account, credentials or owner data was added to Git.

- An original caller with current target-scoped `service.manage` can register one immutable finite
  restart policy after the scoped, non-native execution has an actual Runtime assignment. The worker
  comes from that assignment, not a request field. A fresh request key cannot reset or replace the
  policy, expiry or restart count. No production grant is created by the code change.
- Core admits replacement executions under the same root and original caller/work/grant/input.
  A fresh ordinal and compute reservation are atomic with the exact qualified adapter binding.
  Concurrent reconciliation and response loss return the same current execution. Previously used
  child slots retain their exact request IDs and stored receipts; changed input conflicts.
- A replacement requires actual termination, accepted compute return, resolved prior child/resource
  calls, current selection/permissions, remaining acceptance/compute capacity and an unexpired finite
  restart allowance. Root success is not inferred from process or controller success. A successful
  program exit ends recovery, with business success and external settlement still unconfirmed.
- A stopped/revoked execution cannot acquire another generation. The current-generation fence applies
  to Runtime claim, release, ordinary resource use and dispatch. The original agent may have ended;
  its retained current grants determine continuation, and revocation still blocks use. Replacement
  instances retain the ordinary service restrictions on management/nesting/other-root access.
- The owner can inspect restart history and stop the exact current execution independently of the
  original service's authority. A stale execution target conflicts. Unclaimed successors use existing
  never-dispatched cancellation and reservation return; claimed instances remain stopping until
  actual termination and return are observed. Stop does not settle outstanding external effects.
- Persistent Runtime mode invokes an explicit Runtime-authenticated reconciliation endpoint before
  polling ordinary pending executions. The controller processes only existing registrations assigned
  to that worker/profile. The read-only pending endpoint and bounded fixture workers remain separate.
  Supervisor errors retain the original journal and exit; systemd still has `Restart=no`.
- Gateway exposes registration, inspection and exact-current stop. The controller endpoint is not a
  public Gateway capability and rejects forged worker identity at Core. The observation carries Core
  source/time/revision and explicitly says health is not observed.

Verification on the final implementation:

| Check | Result |
|---|---|
| Disposable PostgreSQL Core contracts | PASS — 96, including nine new continuation scenarios |
| Shared contracts | PASS — 8 |
| Runtime unit/invariant tests | PASS — 34 |
| Gateway tests | PASS — 34 |
| Actual mTLS Core/Gateway API + CLI | PASS — controller identity boundary, forged worker denial, existing owner/stop/notification flows |
| Actual DB/Catalog/Gateway resource API | PASS — existing reads, writes, publication/retrieval and receipt/restart scenarios |
| Linux ARM64 Runtime target | PASS — all-target compile check; no native process execution inferred |
| Affected-crate and service-test Clippy | PASS — warnings denied |
| Scoped Rust formatting, Python syntax and diff checks | PASS |
| Core/Gateway/CLI/Resources executable builds | PASS |
| Disposable databases/processes | PASS — every runner confirmed child cleanup and PostgreSQL shutdown; existing databases were not accessed |
| Native Linux Company process restart / live Codex / model or exchange call | NOT RUN |

The SQL tests use synthetic trusted Runtime bindings/qualification/termination/return observations;
they do not prove Docker execution. They exercise concurrent/lost-response replay, actual Core
reconstruction, an exited agent origin, preserved DB-write receipt identity, scope revocation,
changed target selection, exhausted capacity, backoff/expiry/counter exhaustion, ambiguous children,
old-instance denial, stale stops, running-stop return barriers and cancellation before dispatch.
A binary child read intentionally blocks cross-instance recovery; its existing byte-delivery boundary
is not widened. Program-input materialization remains separately bound per execution.

Earlier failures are retained in private evidence: the initial child-dispatch query referenced an
absent generation column and was corrected to use the existing unique instance identity; the HTTP
fixture was corrected to assert Gateway's existing exact `503 capability not connected` response;
a local-socket Runtime test was rerun with the required sandbox allowance. None required weakening
the product permission or qualification checks. Source snapshots, the scoped patch and final reports
are retained with this task. No installed service, public release or live Company activation changed.

Next remaining boundaries: desired service availability/qualified health and reserved dependency
capacity; cross-instance binary response recovery; native agent continuation; independent service
grants/nested calls; protected Auth Module execution; native app and Linux end-to-end acceptance.
This checkpoint completes finite recovery of an original operation, not a permanent request-serving
Company host or the autonomous company operating loop. Full app completion remains governed by the
accepted plan and its actual-operation acceptance scenarios.


## 2026-09-19 checkpoint — System call recovery observation and owner control

Continues the finite Company call contract above. Implemented the generic System list/detail,
resource selection and original caller permission observations, execution/effect navigation, finite
restart allowance, exact-target stop and original-request lookup. Company-specific names and sample
records remain development fixtures. The fixed owner IPC capability is not assigned to Company views.
No runtime controller, production configuration, credential, model or exchange call was activated.

The September 15 execution in this task produced these results (historical execution evidence,
not fresh September 19 runs):

| Check | Observed result |
| --- | --- |
| Disposable PostgreSQL Core suite | PASS — 100; includes four new metadata/scope/dependency/stop/pagination scenarios |
| Gateway unit/route tests | PASS — 34 after allowing test-local sockets |
| Actual mTLS Core/Gateway + CLI | PASS — work-scoped service routes, inaccessible work, cursor mismatch and existing control flows |
| Mac frontend | PASS — 111 including 16 service cases and parsing/rendering a real disposable Core observation response |
| Native Mac unit tests | PASS — 12; existing fixture-profile integration test ignored because no profile was supplied |
| Frontend production build / UI and Company boundaries | PASS |
| Core/Gateway affected-crate Clippy | PASS — warnings denied |
| Test databases/processes | Runner confirmed PostgreSQL shutdown and child cleanup; existing DBs were not accessed |
| Browser UI | System list observed at 1440×900 with explicit sample provenance; this is not native IPC or Linux process proof |
| Native Mac-to-Linux process restart/stop/return | NOT RUN |

The initial test correction removed `execution.stop` from all of the fixture owner's matching grants
before asserting inspect-only controls; removing one child grant correctly left another valid owner
grant. A native validation test also found that the general request-key helper accepted path characters;
the new service-control bridge now validates its narrower request-reference alphabet. No authorization
or test oracle was weakened. The first UI assertion was corrected to match the actual `Service health`
label. Existing PublicationDetail lint debt remains outside this change.

On September 19 the source files remained present, but the prior temporary evidence directory and
process sessions had been removed. The table records tool-observed results from this task rather than
claiming those report files are still available. Fresh scoped service-file ESLint, TypeScript build checks
and the existing tracked diff whitespace check passed on September 19. Default Xcode tool selection also reports an unaccepted
license; no agreement was accepted or system setting changed. The already installed Command Line Tools
git can still inspect this checkout directly.

Next: run a disposable Company program with the actual Linux Runtime, observe failed-process recovery
under the same root/effect IDs, then issue a stop from the native app and compare restriction,
termination and resource-return records. Show permission changes/uncertain effects accurately and
verify the flow continues while the UI is closed. Use test data and a deterministic program; model
billing and exchange activity are unnecessary. Resolve local Mac build prerequisites before claiming
native acceptance. Qualified health and the permanent request-serving host remain later boundaries.

### Current delivery boundary — common execution, observation and owner stop

The September 19 owner instruction explicitly asks to close this large accumulated task at a
reviewable boundary. This unit ends after one deterministic, disposable Company operation is
qualified and executed by the real Linux Runtime, an abnormal exit is recovered within the original
finite policy, and the native Mac owner control is compared with actual restriction, termination and
compute-return records. Retain source identity, the observed screen and sanitized result evidence,
and shut down the test services, database and guest after the comparison. Only defects reproduced in
this flow are implementation scope. No model account or exchange activity is needed.

Three remaining acceptance bundles are Linux execution/recovery, native Mac control/record comparison,
and evidence/cleanup. Historical unit and HTTP checks do not replace these bundles. The prior guest
and temporary tool/evidence directories are absent on September 19, so environment preparation is a
prerequisite; do not present it as a product feature or a passed acceptance test.

The permanent request-serving Company host, protected Auth Module host, autonomous CEO operating loop,
and Company business features are subsequent units with their own acceptance. They remain in the
overall product scope but are not conditions for closing this implementation unit. A missing external
prerequisite must be recorded as NOT RUN with its exact blocker; it must not silently expand this
unit or be converted into a success claim. This checkpoint is not a public release or full-app
completion.

### September 19 actual Linux acceptance and remaining native screen check

Prepared a new dedicated Ubuntu 24.04 ARM64 guest with no host-home mount, disposable PostgreSQL
18.6, root-protected immutable product binaries, a source-bound BusyBox program image and synthetic
short-lived identities. No Codex/model account or exchange call was used. The frontend production
build and the updated debug Mac app bundle both built using the already installed Command Line Tools;
no Xcode licence agreement or system tool-selection setting was changed.

The first real run reached finite recovery, the same DB effect receipt, exact owner stop and compute
return, then failed because the persistent Runtime propagated the expected execution-permission 403
as a supervisor error. This failed run is retained. The narrow correction distinguishes that typed
permission observation only after exact claim resolution and actual return; service mode stays
available, while bounded workers, transport uncertainty and all other errors retain their prior
failure behavior. No permission, receipt or cleanup oracle was relaxed.

The second real run passed: independent source/verification, one Company operation, an injected
program SIGKILL, one controller-admitted replacement under the same root, one Company DB row and
unchanged effect/receipt identity, owner CLI stop, both real instances terminated, both reservations
returned, independent guards gone, and a still-running Runtime that subsequently accepted its own
explicit shutdown. The enclosing fixture reported complete owned container/service/database cleanup.
The first and replacement executions are observations of an original operation, not extra owner work
or renewed restart allowances.

Fresh September 19 results: frontend 110 passed; native Mac 12 passed with the existing supplied-profile
integration case ignored; Linux Runtime 46 passed with its separate kernel-only case ignored; affected
Runtime Clippy passed with warnings denied; native-suite tooling 34 and check-catalog tooling 15
passed. The actual Linux program run supplies the process/guard evidence above. These results do not
claim the full repository CI plan passed.

At the preceding checkpoint, native acceptance was still NOT RUN: the UI tool reported a locked
Mac and failed automatic access. That tool response did not independently establish the actual
screen-lock state. The failed-access evidence is retained; it is superseded by the native acceptance
below, not converted into a successful run. The `--native-owner-stop` fixture waits for the real Mac
command instead of submitting a CLI stop.

### September 19 native acceptance completed — implementation unit closed

The owner corrected the lock report. Direct UI access then succeeded. An app process started on
September 16 displayed a blank window; reopening the current built bundle restored the connection
screen without another product-code change. A new dedicated Linux guest was prepared using the same
verified source, deterministic program and disposable identities. The Mac selected its test owner
profile through the normal native file picker and read actual Gateway company/work records.

The real program wrote one Company DB result, was killed, and recovered once under its original
root, effect slot and receipt. The native System screen showed that replacement and zero remaining
restarts. Clicking **Stop call & recovery** produced **Stopping**, while termination and compute return
were still pending. **Check original request** read the same recorded request without resubmission;
the screen then showed **Stop observed**, both executions terminated, **Return confirmed**, and
100/100 compute units available. No CLI stop was submitted in this run.

The independent fixture and screen/record comparison passed. The stop issuer matched the
authenticated Mac owner, and the displayed call, execution and request references matched Core.
There was one DB result and one effect receipt after recovery. Both real containers stopped, their
guards were gone, and committed compute was zero. The shared Runtime remained available after the
per-execution restriction and subsequently shut down normally on its explicit shutdown signal.
After the fixture services ended, the Mac marked retained observations as potentially stale.

| Final acceptance | Result |
| --- | --- |
| Real Linux program and one bounded recovery | PASS |
| Original DB effect and receipt retained without duplication | PASS |
| Native Mac connection, exact stop and original-request lookup | PASS |
| Screen references and state matched authenticated Core records | PASS |
| Actual termination, guard exit and compute return | PASS |
| Fixture processes, containers, DB, test credentials and guest cleanup | PASS |
| Model / exchange calls | 0 / 0 |

The app was closed, its temporary connection reference restored, and the Mac test profile/keys
removed. The guest's remaining test containers and product processes were zero before shutdown;
its private key/URL files, disposable PostgreSQL and dedicated VM were removed or stopped. Sanitized
JSON evidence, native screenshots, accessibility records, hashes and prior failed attempts are
retained in the ignored Mac evidence directory. Product source remained unchanged from the preceding
passing Linux verification; this final pass added native acceptance evidence and this work record.

This closes **common execution, observation and owner stop** at the agreed reviewable boundary.
The permanent Company request host, Auth Module host, autonomous CEO loop and Company business
features are separate subsequent units. This is not full-app completion, whole-repository CI,
commit/merge, public release or deployment.


## Final source cleanup and local commit checkpoint — 2026-09-19

The completed unit remains common execution, observation and owner stop, including the preceding
actual Linux continuation/native Mac acceptance. This cleanup adds no Company business capability,
provider execution or permanent service deployment.

- Fixed publication continuation losing its captured native connection. Configuration operations
  now require an explicit transport, so a missing binding fails TypeScript compilation.
- Preview and Discuss reuse one immutable artifact reference with workspace, revision, path, work,
  delegation and target; conversation routing and reopening retain the original read scope.
- Split connected workspace assembly, screen routing, record inspection and original-publication
  loading. Async publication state cannot display files from an older observation.
- Reproduced a stop-before-claim race that stranded the supervisor slot. Resolution now accepts
  Core's exact never-dispatched cancellation and settled original reservation evidence; an absent
  assignment alone stays unresolved. Actual assigned execution termination/return rules are unchanged.
- Removed the unused earlier control-plane subtree, its 21 obsolete tests, calibration shims,
  starter logos, unused font dependency and unbound read helper. Shared primitives/tokens remain.
  Preserved five unused investment draft files with SHA-256 verification outside the product
  checkout, then removed product Cargo membership. This archive is not a private Company repository.
- Removed the personal brand-exporter path. Build/package/check scripts resolve their own product
  root independently of the caller's directory; packaging rejects nonregular and oversized inputs
  before reading. Repaired and compile-tested the existing embedded MCP transport probe.
- Ignored nested Rust builds, generated native permissions/manifests and local captures. Historical
  design findings and private evidence references now identify their actual scope.

Fresh validation: 91 active frontend tests, six package-tool regressions, 35 native-suite tooling
checks, 38 Runtime unit cases and three focused Core PostgreSQL regressions passed. Native Mac
unit tests passed 12 cases; the separate live-profile case was explicitly skipped. Frontend lint,
TypeScript/production build, calibration build, SDK build, distribution boundary check, Rust
format/Clippy, brand provenance validation and native debug bundle/ad-hoc signature verification
passed. The calibration-only all-screens bundle retains its size advisory.

The isolated PostgreSQL 18 fixture confirmed clean shutdown and removal of its cluster and generated
password/URL files. No existing database, external account, model or exchange was used. Native UI
capture was attempted after rebuilding, but the UI tool reported a locked Mac; there is no fresh
screen claim for this cleanup. The preceding actual screen/record/stop/cleanup evidence remains
preserved and is not relabeled as a new run. Company WebView adversarial qualification and the
remaining whole-product acceptance are still separate work.

Local review artifacts are retained under the ignored `.local/precommit-review/` directory. They
include partitioned source review, the pre-fix reproduction, regression results and a generated
security review report with explicit partial native-adversarial coverage. This checkpoint authorizes
no public release; pushing and opening a PR are separate delivery actions.

## September 20 native UI verification and delivery handoff

Verified the native bundle built from `2a7d7d9` without another product-code change. The owner
provided a rendered connection-screen capture; subsequent native activation, accessibility reads
and window captures succeeded. Earlier blank tool captures did not establish a product rendering
defect or the owner's screen-lock state. Those inconclusive attempts remain separate evidence.

The explicit sample session passed navigation through Home, Work, Agents, System, Conversations,
Library, Notifications, Owner controls, Settings and Portfolio. A native file-save dialog produced
the displayed revision, whose bytes matched the preview. Ask CEO preserved workspace, revision,
path and return context. Reading one sample notification changed the total from four to three and
removed the Library badge. Closing the window hid it while the process remained alive; normal
reopening retained the same process, Home and sample read state. Sixteen current native captures
and the saved test file remain in local evidence outside source Git. No message, operating-company
connection, model call or exchange action was submitted in this verification.

This supplements the September 19 real Linux/native owner-stop acceptance; it does not repeat that
backend scenario or qualify private Company WebViews. The delivery boundary remains **common
execution, observation and owner stop**, with the preceding basic-flow and resource-smoke tooling.

### Bounded Company Service Host

The selected immutable operation plan can now declare an optional `host` policy. The existing
independent submission verification, acceptance, activation, execution, containment and owner-stop
paths still govern the service. One released execution accepts at most `max_requests` separately
authorized requests (1–16), each with bounded object input and result. Input is at most 60 KiB so
the complete admission fits the Gateway's 64 KiB management envelope; a result is at most 64 KiB.
The qualified program deadline still bounds lifetime. Acceptance `max_calls` counts host launches,
so the maximum admitted requests for that acceptance is `max_calls × max_requests`. Hosting does
not register with the finite continuation controller or restart automatically.

`POST /service-hosts/{execution}/requests` retains the original caller, work, delegation, request
key and immutable input. It consumes one request slot and no additional execution or compute.
The authenticated contained instance claims sequentially at `/service-hosts/self/claim` and records
its immutable result at `/service-hosts/self/requests/{request}/reply`. Claims bind the actual
instance and generation. Each resource request selects that claim with `x-ouro-service-request`
and its qualified `x-ouro-effect-slot`; these selectors do not carry caller authority. Core derives
the caller from the retained request and rechecks current invocation and effect permissions at
admission and dispatch. Effects have independent request/slot identities. A finalized request
cannot admit further effects, and another host cannot use its claim or reply.

The original issuer recovers with
`GET /intents/by-request-key?operation=service.request&request_key=...`, followed by
`GET /service-requests/{request}`. Reads return the retained state, result, assignment and effect
metadata under current inspection permission. They never resubmit work. Same-key admission replay
also returns the original identity after stop; changed input conflicts. An unclaimed request whose
caller lost permission is visibly restricted before the next eligible request is claimed. An
already claimed request with uncertain effects cannot silently be skipped.

Execution observation includes host policy, request states and effect receipts. Existing execution
stop denies new requests even with spare quota. Acceptance of stop, actual termination, and compute
return remain separate observations; request replies and compute return do not settle external
effects. This unit adds no System-page host controller; the existing execution inspector owns stop.

The September 20 disposable Linux `native.program-host` run observed two distinct request results
and Company DB receipts through one instance/generation, an actual dropped admission response,
original-key recovery without resubmission, stop before the program deadline with one request slot
still available, actual container/guard closure, one compute return and shared Runtime survival.
Its source and separate verifier were real contained programs; business inputs were synthetic and
model/exchange calls were zero. PostgreSQL regressions separately cover concurrent quota/replay,
foreign-host denial, caller revocation, retained unresolved effects and return replay.

Native Mac acceptance is still **NOT RUN for this unit**: the Mac was locked when observation was
attempted. The Linux fixture's owner CLI stop does not prove an app click or a closed Mac window.
The remaining checkpoint is two requests while the app window is visibly closed, then reopening,
observing the retained execution and stopping it through the native execution inspector. The
explicit native-owner fixture mode waits for those observations without submitting the stop.

Protected Auth Module execution, autonomous CEO continuity, private financial services and live
Binance connection remain subsequent units. This synthetic host proof does not deploy or activate
an operating Company, and does not establish whole-product completion.
