# Ouroboros UI 목적 계약

이 문서는 **회장이 무엇을 알고 결정하려는지에서 화면·배치·요소·행동을 도출하는 설계 기준**이다.
화면 설명을 제품 안에 길게 써 넣기 위한 문서가 아니다. 사용자가 설명을 읽지 않아도 값, 비교,
선택, 상세, 피드백으로 이해하도록 만드는 구현·검토용 문서다. 제품 UI는 영어, 설계 설명은 한국어다.

현재 기준: **2026-09-14 Mac 앱의 고정 Workspace + Company 코드·게시 구성 계약**.
구현 원본은 `apps/mac/src`이며 `design/mac-calibration`은 같은 원본을 불러온다. 이전 4화면 v3 시안의
부분 확인·승인 기록은 §10의 역사적 범위로 남긴다. 현재 화면·동작 검증 판정은
[MAC_APP](../implementation/MAC_APP.md)과 [앱 실행·증거](../../apps/mac/README.md)를 따른다.
현재 개발 범위의 완료와 선물 실거래·CEO 자율 운용 전체 인수는 별개다.

## 1. 기준과 문서 책임

- [Application Shell and Views](../architecture/APPLICATION_SHELL_AND_VIEWS.md)는 화면 책임, 공통/도메인 분리,
  권한·자료·상호작용 경계의 원본이다. 이 문서는 그 안의 UX를 요소 단위로 구체화한다.
- [MAC_APP](../implementation/MAC_APP.md)은 구현 순서·현재 상태·검증 증거를 기록한다.
- OpenBoa Brand System `2026.08.23` / `e93f55cbfd90b668ef9d77875f71d8e53f7ceb4b`의 색·글꼴·토큰을
  [앱 공통 UI](../../apps/mac/src/ui/)에 연결한다. 스타일 원본을 별도로 복제하지 않는다.
- 금융 계산·거래 의미는 투자 도메인, 실행·신원·권한·영수증은 공통 기반이 소유한다. UI가 결과를 추론해
  금융 원장이나 권한을 만들지 않는다. 에이전트는 Company 코드·구성을 구현/게시할 수 있지만 고정 Workspace와
  Owner controls는 바꿀 수 없다. 별도 보고·제안함 대신 기존 대화·자료·제어 기록을 연결한다.

### 모든 요소에 필요한 명세

`화면 → 질문별 배치 영역 → 의미 있는 요소 → 공통 부품` 순서로 추적한다. 요소별로 다음을 남긴다.

| 항목 | 설계자가 답해야 하는 내용 |
| --- | --- |
| 목적 | 회장이 어떤 질문에 답하거나 어떤 결정을 하는가? 없어지면 무엇을 못 하는가? |
| 자료·근거 | 값·설명·상태의 원본, 대상 범위, 시각, 버전은 무엇인가? |
| 표현·배치 | 왜 숫자/차트/행/미리보기인가? 왜 그 위치와 크기인가? 먼저 읽힐 것은 무엇인가? |
| 행동 | 무엇을 선택하며 어디로 가는가? 대상과 문맥을 어떻게 보존하고 돌아오는가? |
| 상태 | 정상·빈 값·지연·권한 제한·실패·효과 미확정에서 무엇이 달라지는가? |
| 검증 | 설명 없이 성공 여부를 관찰할 수 있는 기준은 무엇인가? 현재 구현과 관측 증거가 이를 충족하는가? |

문서의 ID는 주석과 검증에서 사용한다. 의미가 바뀌면 기존 ID를 조용히 재활용하지 않는다.
단순한 `div`, 정렬용 wrapper, 아이콘의 SVG path에는 독립된 제품 목적을 발명하지 않는다.
이들은 부모 요소의 배치 목적과 공통 부품 계약을 상속한다. 별도 정보·행동·강조를 추가하면 별도 목적이 필요하다.

## 2. 화면 지도 — 고정 Workspace와 Company

| 위치 / 화면 | 사용자가 얻는 답 / 주요 행동 | 배치의 중심 | 상세 계약 |
| --- | --- | --- | --- |
| Workspace · `Home` | 우선 볼 정보는 무엇인가? 위젯을 선택·배치하고 근거로 이동한다 | 선택한 공통/Company 위젯, 로컬 Save/Cancel | W 계열 |
| Workspace · `Work` | 무엇을 왜 진행하며 실제 결과와 다음 조건은 무엇인가? | 업무와 최근 변화, 관련 실행·산출물 | [O 계열](COMPANY_EXPERIENCE.md)의 업무 목적 |
| Workspace · `Agents` | 누가 책임지며 어떤 실행·활동이 있었나? | 지속 구성원, Executions / Activity & trace | [O 계열](COMPANY_EXPERIENCE.md)의 구성원·실행 목적 |
| Workspace · `System` | 어떤 연결·자원이 관측됐고 어디가 불확실한가? | Services & connections / Execution resources / Events | N 계열 |
| Workspace · `Conversations` | 누구와 무슨 맥락으로 논의하나? | 방 목록·수신자·대화·첨부 근거·입력 | [R 계열](COMMUNICATION_AND_LIBRARY_EXPERIENCE.md) |
| Workspace · `Library` | 무엇이 실제 게시됐고 정확한 버전은 무엇인가? | 검색 가능한 자료 행, 고정 revision 원문 | [A 계열](COMMUNICATION_AND_LIBRARY_EXPERIENCE.md) |
| Workspace · `Notifications` | 아직 읽지 않은 변화는 무엇이고 어느 기록에서 확인하나? | 읽음·분류 필터, 원본 이동, 선택한 알림 읽음 처리 | NT 계열 |
| Company · 게시 페이지 | 회사가 강조하는 결과·업무는 무엇인가? 투자 회사는 Portfolio와 금융 위젯으로 자본·성과·노출을 확인한다 | 등록된 화면 또는 위젯 구성, 출처·실제 근거 | [P 계열](PORTFOLIO_EXPERIENCE.md), W 계열 |
| Settings · 본문 탭 | 이 Mac의 표시·연결·공유 회사 구성·설치된 모듈·유지관리 상태는 무엇인가? | General / Connections / Company / Modules / Maintenance, 가로 스크롤 탭 | N 계열 |

기본 진입은 Home이며 투자 정보를 우선 배치할 수 있다. Workspace 7개 경로와 하단 Owner controls는
고정이다. Notifications는 Library 다음에 둔다. Company 메뉴는 호환되는 실제 게시 구성이 정하며
설치 모듈 목록 자체가 메뉴를 만들지 않는다. Settings는 사이드바의 단일 항목이며 하위 트리를 만들지 않는다.
설정 본문에서 다섯 탭을 전환하고 좁은 폭에서는 가로로 스크롤한다. 회사 이름 옆에는 출처 배지를 두며,
테마와 Change company connection은 General 안에 둔다.
상세는 본문 전체를 사용하고 Back/Close로 복귀한다. 오른쪽 패널을 계속 열어 두는 구조가 아니다.
투자·Company 모듈이나 CEO 응답 없이도 공통 관찰·대화·파일·정확한 실행 제어 경로는 남는다.
화면이 열리는 것과 서버 자료 접근·명령 적용 성공은 별개다.

<a id="widgets"></a>
### Home 위젯과 Company 구성의 요소 목적

| ID / 요소 | 회장의 질문 · 자료 근거 | 배치 이유 / 행동 | 상태·검증 |
| --- | --- | --- | --- |
| <a id="w-01"></a>W-01 · Home widget | 자주 확인할 값·업무·근거는 무엇인가? 등록 공급자의 관측과 reference | 제목·공급자·관측을 묶고 선택하면 원본 상세로 이동한다 | unknown을 0으로 만들지 않는다. 공급자 실패는 해당 위젯에 표시하고 고정 제어를 가리지 않는다 |
| <a id="w-02"></a>W-02 · Edit home | 화면을 나에게 맞게 바꾸려면? 현재 scope의 저장 배치 | 보기/편집을 분리하고 Add, 순서·크기, Remove를 제공한다. 드래그 외 위/아래 버튼도 둔다 | 편집으로 모델·회사 명령이 실행되지 않는다. 빈 배치는 실패가 아니다 |
| <a id="w-03"></a>W-03 · Widget picker | 어떤 정보를 추가할 수 있나? 현재 widget registry | 공급자별 이름·목적·지원 크기를 비교한다. 실행 코드 입력창이 아니다 | 미등록/미접근 widget은 unavailable로 남긴다. 개수·크기 제한을 보존한다 |
| <a id="w-04"></a>W-04 · Save / Cancel layout | 무엇이 누구에게 저장되나? 환경·회사·소유자 scope의 로컬 배치 | Save는 개인 Home만 저장하고 Cancel은 편집을 버린다 | 실패는 기존 배치를 유지한다. Company 게시 구성이나 다른 scope의 배치를 바꾸지 않는다 |
| <a id="w-05"></a>W-05 · Company page | 무엇을 게시하고 적용한 화면인가? 정확한 패키지·검증·선택/관측 기록 | 독립 빌드된 Company page/widget을 격리 표시하며 SDK 토큰·컴포넌트와 Work·Library 근거를 연결한다 | 게시·검증·선택/적용·실제 표시를 구분한다. 패키지 교체는 앱 재빌드 없이 가능해야 하고 잘못된 후보가 유효한 현재 선택을 덮지 않는다 |

<a id="layout"></a>
## 3. 배치 계약

| ID / 영역 | 목적과 형태 | 크기·우선순위 판단 | 상태·검증 |
| --- | --- | --- | --- |
| <a id="l-01"></a>L-01 · App frame | 고정 탐색 / 현재 화면 / 본문 상세를 구분한다 | 1440×900 기준, 최소 1100×720. 현재 layout alias는 sidebar 208, header 80이다. 개발 toolbar와 과거 inspector 폭은 본문 배치 기준이 아니다 | 창이 작아져도 주 메뉴·고정 제어·현재 대상·닫기 경로를 잃지 않는다. 검토 도구를 제품 header로 이식하지 않는다 |
| <a id="l-02"></a>L-02 · Question groups | 같은 질문의 값·범위·행동을 한 그룹으로 묶는다 | 관련 metadata 8, 내부 묶음 16, 본문 padding 24, 질문 간 32의 source spacing을 출발점으로 사용한다. 섹션 구분선 대신 정렬·간격·필요한 배경으로 구분한다 | 같은 값의 중복 카드, 의미 없는 빈 영역, 모든 카드의 동일 높이를 요구하지 않는다 |
| <a id="l-03"></a>L-03 · Portfolio hierarchy | 자본·기간 결과 → 현재/미체결 노출 → 변화와 근거 순서다 | 넓을 때 주 본문에 자본·성과·기록, 오른쪽에 노출·관련 CEO 문맥. 차트가 공간을 독점해 남은 의무를 밀어내지 않는다 | 좁으면 자본과 중요한 노출·예외를 먼저 읽고 차트·기록, CEO 보조 문맥으로 흐른다. 최소 창에서 큰 차트를 먼저 스크롤해야만 미확정 주문을 발견하는 배치는 재검토한다 |
| <a id="l-04"></a>L-04 · Work / Agents hierarchy | 책임과 실제 일을 함께 비교한다 | Work는 업무·최근 변화, Agents는 구성원·현재 책임과 실행·Trace를 중심으로 둔다. 조직도나 실행 카운터가 가장 큰 시각 요소가 되지 않는다 | CEO 한 명·대기 중·인계 중이어도 목적·책임·다음 조건을 읽을 수 있다 |
| <a id="l-05"></a>L-05 · Conversations hierarchy | 방 선택과 대화를 왕복한다 | 방 목록은 탐색 폭, 메시지 본문은 읽기 폭을 확보하고 입력을 대화 하단에 고정한다. 첨부 근거는 메시지 근처에 둔다 | 방 전환 시 초안·읽던 위치를 보존한다. 작은 창에서 방 목록을 접어도 선택 방과 돌아갈 경로가 남는다 |
| <a id="l-06"></a>L-06 · Library hierarchy | 목록 비교와 실물 확인을 왕복한다 | 자료 행에 이름·타입·작성자·업무·버전, 선택한 자료에 미리보기. 긴 설명은 선택 후 제공한다 | 미리보기를 지원하지 않는 타입도 metadata·정확한 저장 경로는 유지한다 |
| <a id="l-07"></a>L-07 · Full-page detail | 질문을 따라 근거를 확인한 뒤 원래 위치로 돌아간다 | 본문에 한 상세만 표시한다. 관련 기록은 내용을 교체하며 복귀 스택을 보존한다. 고정 탐색과 Back/Close는 남는다 | 계좌·기간·선택·scroll·focus가 복원된다. 패널 위 패널을 쌓아 원래 대상이나 고정 제어를 찾을 수 없게 하지 않는다 |

레이아웃 크기는 의미와 읽기 순서를 보존하기 위한 제약이다. 글자를 줄여 오버플로를 감추거나,
계약·시각·단위를 생략해 맞추지 않는다. 긴 이름은 필요한 경우 줄 바꿈하고 숫자 열은 정렬한다.
상세에서 같은 금액을 반복할 때는 대상 식별에 필요한 요약으로만 쓴다. 본문의 카드 전체를 다시 복제하지 않는다.

<a id="shell"></a>
## 4. 고정 Shell과 공통 이동

아래 각 행의 읽기 근거는 현재 신원으로 허용된 projection이다. 제목·모양만으로 상태나 권한을 추론하지 않는다.

| ID / 요소 | 목적·근거 | 표현·배치 / 행동 | 상태·검증 |
| --- | --- | --- | --- |
| <a id="s-01"></a>S-01 · Product and company | 어떤 제품·회사·환경을 보고 있는지 구분한다. 회사 이름은 회사 기록, 환경은 실제 연결 설정에서 읽는다 | 탐색 위쪽에 제품과 회사 이름을 두고 이름 옆 출처 배지로 실제 연결/개발 자료를 구분한다. 연결 전환은 General의 `Change company connection`으로 제공한다 | 회사가 하나면 가짜 선택기를 만들지 않는다. `Test`와 실제 환경 구분은 모든 상세에 이어진다. 연결됐다는 이유로 `Operating`을 표시하지 않는다 |
| <a id="s-02"></a>S-02 · Primary navigation | 고정 Workspace 7개와 게시된 Company 화면 사이에서 현재 위치를 안다 | 안정된 아이콘·영어 label·선택 상태를 사용한다. 주 메뉴는 실제 화면 이동이며 샘플 Sheet로 대체한 상태는 미구현으로 기록한다 | 키보드와 focus로 이동 가능하고 각 화면의 선택·scroll을 복원한다. 도메인 페이지 실패에도 공통 메뉴가 남는다 |
| <a id="s-03"></a>S-03 · Scope and observation | 지금 읽는 자료의 계정·기간·대상·시각을 해석한다 | 화면 상단에는 공통 범위, 개별 값에는 공통 범위와 다른 시각/누락만 둔다. 범위 상세에서 출처·coverage를 연다 | 현재 값과 기간 값의 범위를 혼합하지 않는다. 갱신 중에는 마지막 관측 시각을 유지한다 |
| <a id="s-04"></a>S-04 · Search | 기억하는 이름·계약·업무·자료에서 원본으로 빨리 간다 | 고정 검색 진입. 결과는 타입·제목·짧은 문맥·버전/시각을 포함한 행이며 해당 상세로 이동한다 | 조회 권한 밖의 제목/내용을 노출하지 않는다. no match/권한 제한/검색 실패를 구별한다. 단순 검색이 메시지·업무를 만들지 않는다 |
| <a id="s-05"></a>S-05 · Attention and unread | 회장에게 필요한 개입·적용 확인과 읽지 않은 소스 이벤트를 구별한다 | 메뉴 unread는 NT-02의 서버 집계를 사용한다. Owner controls의 실제 결정·제어 결과는 해당 원본 계약으로 따로 확인한다 | 읽음은 해결·승인이 아니며 unread를 결정 대기나 미확정 의무 수로 바꾸지 않는다. 출처 계약이 없는 메뉴에는 개수를 만들지 않는다 |
| <a id="s-06"></a>S-06 · Owner identity | 현재 누가 어떤 권한으로 보는지 안다 | 하단 프로필은 현재 소유자 신원, 클릭 시 허용된 신원/설정 경로. 회사 위임 변경은 Owner controls로 이동한다 | 오래된 로그인 표시로 현재 권한을 보증하지 않는다. 진단 ID는 복사 가능하되 기본 이름을 UUID로 대체하지 않는다 |
| <a id="s-07"></a>S-07 · Persistent controls | 어느 화면에서도 연결 상태와 정확한 개입 경로를 찾는다 | 하단 `Settings`·`Owner controls` 고정. Settings의 본문 탭으로 Connections 등을 열며 연결 전환은 General에 둔다. 선택한 대상이 있으면 제어 상세에 명시적으로 가져간다 | hover 없이 찾고 키보드로 연다. 회사·도메인이 숨기거나 일반 중지 하나로 합치지 못한다 |
| <a id="s-08"></a>S-08 · Context and return | 숫자→근거→질문→원래 화면의 흐름이 끊기지 않는다 | 선택한 record reference를 상세·대화에 보이는 chip으로 전달한다. chip은 원본 열기와 입력 전 제거를 지원한다. Back/Close 역할을 구분한다 | 회사·계좌·기간·revision이 다른 대상에 조용히 바뀌지 않는다. Escape는 맨 위 한 층만 닫고 opener로 focus를 반환한다 |
| <a id="s-09"></a>S-09 · Source details | 설명과 실제 관측을 대조한다 | source/time/coverage를 가까이 두고 클릭해 영수증·원본·정확한 버전을 연다. 기술 식별자는 펼친 진단 영역에서 복사한다 | 원본 미접근 시 이유를 보이고 다른 최신 파일로 대체하지 않는다. 출처 미상 상태를 숨기지 않는다 |
| <a id="s-10"></a>S-10 · Review tools | 개발자가 토큰·부품·상태를 검토한다 | `Design preview`, `Components`, `Typography`, sample marker는 개발 환경에만 둔다 | 제품 메뉴와 구별된다. 예시 금액·메시지를 실제 회사 자료로 해석할 수 없어야 한다. `ComponentSpec` 통과가 제품 UX 통과는 아니다 |
| <a id="s-11"></a>S-11 · Domain summary contribution | 다른 일을 보는 동안에도 투자 규모와 중요한 미확정 상태를 놓치지 않는다 | 등록된 투자 요약을 Home widget 또는 지원되는 header slot으로 제공한다. 선택하면 같은 회사·계좌의 Company 투자 페이지로 이동한다. 모든 화면에 금융 header를 강제하지 않는다 | 공통 Shell은 금융 값을 계산하지 않고 등록된 기여를 호스팅한다. 범위·시각·미연결/오래됨을 보존하며 도메인이 없으면 빈 금융 카드 대신 영역을 생략한다. 도메인 실패가 고정 제어를 가리지 않는다 |

<a id="notifications"></a>
### Notifications — 읽지 않은 변화에서 실제 기록으로

현재 구현은 앱 안의 알림이다. macOS 푸시는 구현하지 않았다. Core `GET /notifications`의 안정된 event ID와
소스 참조, owner별 읽음 상태가 원본이며 로컬 알림 DB를 따로 만들지 않는다. 실제 오류·투자 의무·결정의
해결 여부는 알림 밖의 원본 기록이 소유한다. 미래의 금융·상태 경보를 현재 알림 coverage로 주장하지 않는다.

| ID / 요소 | 목적·근거 | 표현·배치 / 행동 | 상태·검증 |
| --- | --- | --- | --- |
| <a id="nt-01"></a>NT-01 · Notification feed | 아직 읽지 않은 변화와 근거를 찾는다 | All/Unread와 message/execution/control/publication 필터, 소스 이벤트 행, Open source를 제공한다 | 안정된 ID로 중복을 구분하고 원본 위치로 이동한다. 조회 실패·빈 목록·로딩을 구별하며 권한 밖 제목을 남기지 않는다 |
| <a id="nt-02"></a>NT-02 · Shared unread badges | 어느 화면에 읽지 않은 변화가 있는지 안다 | 알림 화면과 메뉴가 동일 서버 집계를 사용한다. Conversations=message, Agents=execution, System=control, Library=publication, Work=execution+control, Notifications=total | 0·미관측은 배지를 생략한다. 로드된 행/필터로 전체 수를 다시 계산하지 않는다. 메뉴끼리 범위가 겹치므로 배지를 더해 total을 만들지 않는다. Company·Settings·설정 탭은 범용 slot만 두고 소스 계약 전 숫자를 만들지 않는다 |
| <a id="nt-03"></a>NT-03 · Read selected notifications | 확인한 알림만 읽음으로 보존한다 | `POST /notifications/read`에 명시한 ID만 최대 100개 제출한다. Mark shown as read는 현재 로드·필터된 unread만, Open source는 선택한 ID 하나만 요청한다 | Core가 현재 권한을 다시 확인한다. 영수증이 인정한 ID와 서버 집계만 반영한다. 읽음은 승인·해결·원본 재실행이 아니며 producer/model을 호출하지 않는다. 일반 메뉴 방문은 전체 읽음 처리가 아니다 |
| <a id="nt-04"></a>NT-04 · Scope and continuation | 어떤 범위까지 읽었고 무엇이 더 남았는지 안다 | 서버 snapshot/cursor로 Load more를 이어가며 집계 범위와 현재 로딩/오류를 표시한다 | 회사·환경·소유자 변경 시 이전 scope의 자료를 비운다. 읽음 상태는 서버 기록이며 macOS 푸시나 모든 금융 경보 지원으로 표현하지 않는다 |

<a id="owner-controls"></a>
## 5. Owner controls — 정확한 대상에 대한 개입

목적은 “멈추는 버튼”을 만드는 것이 아니라 **무엇이 바뀌고 무엇이 남는지 확인하며 개입하는 것**이다.
일상 업무는 현재 위임 안에서 계속된다. 대화의 승인 문구는 제어 요청이나 권한 변경이 아니다.

| ID / 요소 | 목적·근거 | 표현·배치 / 행동 | 상태·검증 |
| --- | --- | --- | --- |
| <a id="t-01"></a>T-01 · Current delegation | 지금 허용한 범위와 적용 중인 제한을 확인한다 | 패널 상단에 목적·유효 버전·허용 범위·실제 관측된 제한을 요약하고 원본을 연다. 제품에서 임의 기본 자본/위험 한도를 채우지 않는다 | unknown/철회 적용 중/적용 확인을 구분한다. 회사 설명보다 현재 권한 기록을 따른다 |
| <a id="t-02"></a>T-02 · Pending decision | 무엇을 왜 회장이 결정해야 하는지 확인한다 | 정확한 제안의 대상·버전·변경 전후·필요 이유·근거·영향·미확인 항목을 표시한다. 기록이 지원하는 Accept/Reject/Request changes만 노출한다 | 이미 처리됨·오래된 버전·권한 없음은 현재 결과와 함께 표시한다. 카드 수락을 실제 적용 완료로 바꾸지 않는다 |
| <a id="t-03"></a>T-03 · Target and change | 같은 이름의 다른 대상이나 범위를 조작하지 않는다 | 제어 제목 바로 아래 대상 계정/계약/주문/실행/위임과 버전을 둔다. 입력은 실제 명령 필드만 사용하고 변경 전후를 비교한다 | 검증 오류는 해당 필드에, 입력은 보존한다. 새 대상 버전을 받으면 기존 검토 결과를 재사용하지 않는다 |
| <a id="t-04"></a>T-04 · Submit and observe | 요청 이후 실제 결과와 남은 책임을 확인한다 | 구체적 동사 버튼→제출 중→접수→실제 적용을 같은 대상의 처리 기록으로 보여준다. 요청 키를 보존한다 | timeout은 `Outcome unknown`. 원래 요청을 조회하며 새 주문/실행을 자동 재제출하지 않는다. toast만 남기지 않는다 |
| <a id="t-05"></a>T-05 · Remaining obligations | 실행이 끝나도 남은 주문·노출·비용이 있는지 확인한다 | 제어 결과 아래 실제 관측된 미체결·포지션·자원·미확정 효과 링크를 둔다 | 확인되지 않은 항목은 `Not reconciled`. 화면이 닫히거나 실행이 종료됐다는 이유로 정산 완료를 표시하지 않는다 |
| <a id="t-06"></a>T-06 · Control history | 누가 어떤 버전을 요청했고 무엇이 적용됐는지 되짚는다 | 대상별 처리 내역에서 요청·접수·영수증·관측을 시간순으로 읽는다. 원래 대상 상세로 돌아간다 | 오래된 이력이 현재 권한처럼 보이지 않는다. 중복 이벤트로 같은 요청이 새 결정처럼 나타나지 않는다 |

각 제어의 **입력·근거·완료 의미**는 다음처럼 분리한다. 공통 T-03/T-04 폼 패턴을 공유하되 의미를 합치지 않는다.

| ID / 제어 label | 대상·사용자가 검토할 변경 | 관측할 결과 / 남는 정보 |
| --- | --- | --- |
| <a id="t-07"></a>T-07 · `Restrict new exposure` | 지원되는 계정·계약·위임 범위와 신규 노출 제한의 전후 값. 투자 도메인 명령 | 도메인의 제한 적용 근거. 기존 주문·포지션과 모니터링·정리 가능 범위를 별도로 보인다 |
| <a id="t-08"></a>T-08 · `Cancel order` | 선택한 실제 주문, 현재 체결/잔량, 취소 요청 범위. 투자 도메인 명령 | 거래소 취소 확인과 경합 중 발생한 체결. 취소 접수만으로 잔량 0을 만들지 않는다 |
| <a id="t-09"></a>T-09 · `Reduce position` / `Close position` | 선택 포지션과 지원되는 수량/방식·현재 허용 범위. 투자 도메인 명령 | 관련 주문·체결·남은 포지션을 확인한다. 요청 직후 포지션을 목록에서 지우지 않는다 |
| <a id="t-10"></a>T-10 · `Stop execution` | 정확한 실행과 담당자·업무, 영향을 받는 실행/자원 범위. 공통 Runtime 명령 | terminal 관측·실행 종료·자원 반환을 구별한다. 포지션 정리나 하위 업무 전체 완료를 뜻하지 않는다 |
| <a id="t-11"></a>T-11 · `Revoke delegation` | 정확한 위임 버전, 허용 범위와 영향을 받는 사용 주체·하위 자원. 공통 권한 명령 | 철회 접수와 실제 제한·회수 관측, 남은 효과. 과거 세션 복구가 철회를 되돌리지 않는다 |
| <a id="t-12"></a>T-12 · `Shut down operations` | 신규 활동 제한, 필요한 대조·정리, 서비스 종료의 실제 지원 단계 | 단계별 적용과 미결 의무. UI 창 닫기와 구별하며 미확정 투자 효과를 무조건 완료 처리하지 않는다 |

**역사적 v3 범위:** 당시 시안은 주문의 취소 대상·현재 체결/잔량·남는 의무, 선택 실행의 principal/업무·정지 대상·변경 전후를
고정 상세에서 설명한다. Company의 실행/Trace에서 `run-nova`의 정지 검토까지 연결되며 명령 버튼은
`Preview only`로 비활성화한다. 대상 미선택 상태에서 실행을 임의로 고르지 않는다.
이는 당시 T-03/T-05/T-08/T-10의 검토 표현을 시연한 범위다. 당시 실제 위임 조회·승인·명령 제출·접수·적용·
자원 반환·제어 이력은 미구현이었으며, 화면을 열었다는 이유로 T-01–T-12를 충족했다고 기록하지 않는다.
활성화 조건은 단순 “연결됨”이 아니라 해당 대상의 현재 권한·명령 지원·필수 관측이 충족됐는지다.

<a id="connections"></a>
## 6. System·Settings·회사 구성

| ID / 요소 | 목적·근거 | 표현·배치 / 행동 | 상태·검증 |
| --- | --- | --- | --- |
| <a id="n-01"></a>N-01 · Connection list | 어떤 수단이 무슨 일을 위해 연결돼 있는지 안다 | 서비스 이름·용도·사용 업무·핵심 상태를 행으로 비교한다. 시장·거래 계좌·모델·MCP·DB·파일은 공통 연결 형식과 각 도메인 의미를 사용한다 | 등록/인증/검증/활성화/최근 실제 사용을 합치지 않는다. `runtime_ready:false`를 준비 완료로 바꾸지 않는다 |
| <a id="n-02"></a>N-02 · Connection detail | 실패 위치와 사용할 수 있는 범위를 확인한다 | 관측 단계·권한·한도·최근 실패·미확정 효과·관리 책임·검증 시각을 표시한다. 지원되는 검사/인증 갱신/설정 경로만 제공한다 | 검증 통과가 실제 계좌 사용 성공은 아니다. 재검사 결과와 원래 실패를 연결한다 |
| <a id="n-03"></a>N-03 · Setup form | 사람에게 의미 있는 이름과 필요한 정보로 연결한다 | 연결 종류→용도→필요한 설정→검증 결과의 좁은 흐름. label과 인접 validation을 사용한다. 비밀은 Rust/custody 경로에서 처리한다 | UUID·인증서 경로·raw JSON을 기본 입력 경험으로 삼지 않는다. 입력 실패가 비밀을 로그/대화/화면에 노출하지 않는다 |
| <a id="n-04"></a>N-04 · Resource usage | 누가 무엇을 점유하고 비용·의무가 남았는지 확인한다 | 자원별 할당·예약·사용·반환과 관련 업무를 비교하고 근거를 연다. 비용은 추정/측정/청구와 실제 범위를 함께 읽는다 | 같은 사용의 비용 단계를 중복 합산하지 않는다. 자원 반환과 비용 확정을 분리한다. 금융 원장과 모델 비용의 차이는 보존한다 |
| <a id="n-05"></a>N-05 · Storage | 어떤 자료가 보존·사용·정리 대상인지 확인한다 | 임시/보존/사용 중/정리 대기·실제 회수 관측을 보여준다. 파일 확인은 정확한 Library 참조로 이동한다 | 삭제/정리는 실제 지원 제어와 대상 검토를 거친다. 정리 요청만으로 회수 용량을 성공으로 더하지 않는다 |
| <a id="n-06"></a>N-06 · Maintenance | 서비스·백업·복구를 실제 검증 시점 기준으로 판단한다 | 서비스 상태·최근 백업·복구 검증 시각·실패 단계·관리 책임을 표시한다. 고정 관리 기능만 노출한다 | 백업 파일 존재가 복구 성공을 뜻하지 않는다. 앱이 DB·Docker·보호 파일을 직접 읽어 API 부재를 감추지 않는다 |
| <a id="n-07"></a>N-07 · Local preferences | 이 Mac의 표시 설정을 조정한다 | General의 System/Light/Dark 테마 선택을 사용한다. 표시 밀도·알림 전송·로그인 시 운영 관리 시작은 지원되는 설정 계약이 생길 때 별도로 제공한다 | 현재 테마 제공을 전체 알림/시작 설정의 완료로 표현하지 않는다. 회사 원장과 서버 읽음 상태를 로컬 설정 DB로 대체하지 않는다 |
| <a id="n-08"></a>N-08 · Disconnect / reset | 화면 연결 해제·제거가 무엇을 남기는지 안다 | 회사 데이터 보존을 기본으로, 연결 해제와 데이터 삭제의 대상을 따로 명시한다 | 앱 제거가 외부 주문·의무를 해소했다고 표시하지 않는다. 데이터 삭제는 별도 명시적 대상 검토가 필요하다 |
| <a id="n-09"></a>N-09 · Settings → Company | 회사 프로필·공유 화면·운영 버전 중 무엇을 바꾸는가? 각 원본과 revision이 근거다 | 프로필·현재 구성·후보 패키지/검증·선택된 버전·실제 적용 결과를 구분한다. 개인 Home은 그대로 둔다 | 가져오기나 게시만으로 실행을 활성화하지 않는다. current revision·권한·보존 조건과 원래 요청을 확인한다. 현재 후보 설치/적용 미완료를 표시한다 |
| <a id="n-10"></a>N-10 · Settings → Modules | 어떤 Company UI·서비스 패키지가 호환되고 선택되어 있는가? 출처·정확한 버전·검증 범위가 근거다 | 제품 Host/SDK 호환성과 Company source commit·화면/widget/operation·의존 서비스·검증·현재 선택·실제 사용을 읽기 전용으로 비교한다 | main 최신 commit은 운영 버전이 아니다. UI와 서비스 적용·건강 상태는 별도다. 목록을 읽으려고 private 코드를 실행하지 않는다 |
| <a id="n-11"></a>N-11 · Publication outcome | 공유 파일 변경이 실제 기록됐는가? intent·manifest revision·readback이 근거다 | Upload→publish→exact readback과 별도의 executable selection/application을 구별하고 충돌·미확정이면 기존 관측을 보존한다 | 전체 manifest 항목을 보존한다. Catalog·구성·권한·적용 revision을 구분하고 timeout 뒤 새 요청으로 자동 재시도하지 않는다 |
| <a id="n-12"></a>N-12 · Settings tabs | 설정을 하나의 진입점에서 찾고 같은 범주로 돌아온다 | 사이드바에는 Settings 하나만 두고 본문에 General / Connections / Company / Modules / Maintenance 순서의 가로 스크롤 탭을 둔다. 선택한 탭과 내용을 보존한다 | 좁은 폭과 키보드 focus에서도 선택한 탭이 보인다. 테마·연결 전환은 General에, Owner controls는 고정 하단에 유지한다 |

제품 폼에는 실제 필요한 설정만 포함한다. 설치나 권한이 필요하지 않은 조회에 의례적인 확인창을 추가하지 않는다.
**역사적 v3 범위:** 당시 `Connections`는 거래소/선택 계약, 실제 미연결 상태, 현재 샘플 시나리오, credential 등록 부재와
Runtime 미연결을 구별해 표시한다. 연결 버튼은 비활성이며 시나리오 변경은 실제 연결·갱신이 아니다.
회사 비용 상세에는 주간 샘플의 모델·compute·데이터 비용과 coverage 및 관련 실행/출처 링크가 있다.
당시 실제 자원 할당·반환 원장, 연결 설정/인증, 저장소 정리, 백업·복구와 유지관리는 미구현이었다.
개발 검토 도구의 테마 전환은 동작하지만 N-07의 전체 Mac 설정 경험을 구현한 것은 아니다.

<a id="onboarding"></a>
## 7. 시작·재연결·복구

| ID / 요소 | 목적·근거 | 표현·배치 / 행동 | 상태·검증 |
| --- | --- | --- | --- |
| <a id="b-01"></a>B-01 · Entry path | 새 환경 연결인지 기존 회사로 돌아가는지 판단한다 | `Set up`, `Reconnect`, `Recover connection`을 실제 상태에 맞게 구분한다. 기존 참조가 있으면 해당 회사부터 확인한다 | 기존 회사를 새 회사처럼 생성하지 않는다. 동작하지 않는 선택지는 성공 경로처럼 제공하지 않는다 |
| <a id="b-02"></a>B-02 · Identity and environment | 올바른 회사·소유자·환경을 검증한다 | 확인된 이름·환경·검증 단계와 필요한 다음 입력만 보여준다. 서비스 준비 상태를 조회한다 | 인증 성공, 연결 성공, 운용 준비를 따로 표시한다. 실패하면 입력과 관측 증거를 유지한다 |
| <a id="b-03"></a>B-03 · Required decisions | 운영에 필요한 실제 누락 결정만 해결한다 | 연결·운영 책임·위임·자본/자원 조건의 확인 결과에서 누락 항목만 연결한다. 투자 설정값은 사용자가 정한 실제 기록을 따른다 | 임의 거래소 권한·자본·위험 한도·평가 공식을 채우지 않는다. 모든 작업을 수동 생성하도록 요구하지 않는다 |
| <a id="b-04"></a>B-04 · Start and observe | 운영 개시가 필요한지와 책임자가 실제로 활동했는지 확인한다 | 이미 운용 중인 회사 재연결은 읽기만 수행한다. 최초 활성화가 필요한 경우 기존 위임과 준비 결과를 근거로 지원되는 `Start operations`의 정확한 대상·변경을 검토·제출한 뒤 책임자·첫 판단/대기 조건을 관측한다 | 개시 명령 미지원은 준비 완료로 대체하지 않는다. 접수와 활동 관측을 구분하며 재연결에서 개시를 중복 제출하지 않는다. 복원 세션·애니메이션을 활동 증거로 쓰지 않는다 |
| <a id="b-05"></a>B-05 · Reconcile after interruption | 절전·VM 정지·인증 만료 후 불확실한 결과를 대조한다 | 재연결 단계, 마지막 관측과 현재 시각, 계좌/실행/미확정 효과의 대조 상태를 보여준다 | 원래 요청 ID로 확인하며 주문·실행을 자동 다시 제출하지 않는다. 대조 전 정상 배지를 켜지 않는다 |
| <a id="b-06"></a>B-06 · Close and reopen | 앱을 닫았다 돌아와도 회사 기록과 작업 위치를 이어 본다 | 창 닫기는 UI 종료, 운영 종료는 T-12. 다시 열면 서버 현재 상태와 보존된 로컬 참조를 조회한다 | 운영이 UI와 독립적인지 실제 프로세스로 검증한다. Mac 절전 중에도 계속 운용됐다고 가정하지 않는다 |

첫 연결은 일상적인 Workspace 메뉴가 아니다. 연결 후 해당 scope의 Home으로 진입한다. 현재 앱은 연결·저장된 연결·
명시적 샘플 탐색을 구분한다. 폼이나 재접속 성공만으로 B-03/B-04의 운영 개시·자율 활동을 인정하지 않는다.

<a id="shared-states"></a>
## 8. 공통 상태 문법

활동·권한·자료·외부 효과를 하나의 초록 상태로 합치지 않는다. 각 요소는 질문에 필요한 축만 노출한다.

| 축 | 구분해야 할 상태 | 사용자에게 보이는 차이 |
| --- | --- | --- |
| 활동 | 판단/수행, 정상 대기, 의존성 차단, 인계, 미관측 | 짧은 상태와 실제 다음 조건. 대기에는 실패 색이나 재시도 CTA를 강제하지 않는다 |
| 권한 | 유효, 일부 제한, 중지·철회 적용 중, 적용 확인 | 적용 범위와 제어 기록 링크. 모델의 메시지를 권한 근거로 쓰지 않는다 |
| 자료 | 최신, 오래됨, 일부 범위, 없음, 미연결, 접근 제한 | 마지막 관측·coverage·구체적 이유. 현재 수치 옆에 해당 값의 문제를 표시한다 |
| 외부 효과 | 확인됨, 처리 중, 결과 미확정, 대조 필요 | 영수증과 관측을 분리하고 미확정 상태에서 새 효과를 자동 재제출하지 않는다 |

| 공통 상태 | 표현과 행동 계약 | 검증 기준 |
| --- | --- | --- |
| Initial loading | 해당 값/행의 자리 Skeleton. 필수 범위는 먼저 보여준다 | 임시 0·녹색 정상·가짜 진행률을 표시하지 않는다 |
| Refreshing | 마지막 값·시각·선택을 유지하고 작은 갱신 상태를 더한다 | 새 결과가 올 때까지 기존 근거가 사라지지 않는다 |
| Observed zero / empty | 0과 단위 또는 `No open orders`처럼 확인된 부재를 표시한다 | 미조회·실패·권한 제한을 0건으로 계산하지 않는다 |
| Missing / restricted | 값 자리에 dash와 실제 이유, 지원되는 다음 행동 | 숨긴 금액을 다른 값으로 추산하지 않는다. 권한 밖 제목도 노출하지 않는다 |
| Partial / stale | 해당 범위·시각과 비교 제한을 가깝게 표시한다 | 일부 계좌 합계를 회사 전체 자본으로 부르지 않는다 |
| Failed / mismatch | 실패한 요소의 근거·재조회 경로를 유지한다. 전체 범위 문제만 전역 notice | 실패와 timeout의 미확정을 구분한다. 다른 정상 영역까지 빈 화면으로 바꾸지 않는다 |
| Received / applied | 접수와 실제 적용을 대상의 보존된 처리 기록으로 구분한다 | 녹색 check는 그 label에 대응하는 실제 증거가 있을 때만 쓴다 |
| Preview / unsupported | 개발 데이터는 명시하고 비활성 행동의 실제 이유를 밝힌다 | 시안 비활성 버튼을 제품 상태 설계의 완성으로 세지 않는다 |

새 데이터로 값이 바뀌어도 정렬·선택을 임의 이동하지 않는다. 읽음·선택·열람은 업무 완료나 결정 처리와 별개다.
핵심 위험·범위·금액 단위를 tooltip이나 긴 설명 뒤에만 숨기지 않는다. tooltip은 부가 정의·진단에 사용한다.

<a id="primitives"></a>
## 9. 공통 부품 — 용도와 의미가 먼저다

실제 shadcn Mira/Base UI 부품을 사용하며 [Button](https://ui.shadcn.com/docs/components/base/button),
[Badge](https://ui.shadcn.com/docs/components/base/badge), [Tabs](https://ui.shadcn.com/docs/components/base/tabs)의
동작과 접근성 기반을 재사용한다. 부품 선택만으로 제품 목적·데이터·다음 행동이 정해지는 것은 아니다.

| ID / 부품 | 어떤 목적에 쓰는가 | 표현·행동·상태 계약 / 금지할 오용 |
| --- | --- | --- |
| <a id="c-01"></a>C-01 · Typography | 정보의 읽기 우선순위를 일정하게 만든다 | 아래 완전한 역할을 사용한다. 숫자가 중요하다고 모든 data를 550 weight로 올리지 않는다. 설명을 줄이기 위해 본문을 metadata 크기로 내리지 않는다 |
| <a id="c-02"></a>C-02 · Button / link | 명령 수행과 근거 이동을 구분한다 | Button은 동작, link는 실제 대상 이동. default는 필요한 주요 행동, ghost/secondary는 보조 행동, destructive는 실제 파괴적 동작에 사용한다. 이동 링크를 role=button으로 위장하지 않는다 |
| <a id="c-03"></a>C-03 · Select / tabs | 범위를 선택하거나 같은 대상의 다른 질문으로 전환한다 | Select는 실제 선택지가 있을 때만 사용한다. Tabs는 서로 다른 자료/질문을 보여주며 선택·keyboard 상태를 보존한다. P&L/Equity는 같은 차트의 색만 바꾸지 않는다 |
| <a id="c-04"></a>C-04 · Badge / status | 분류·상태·개수를 빠르게 읽는다 | `Long`/`Short`는 방향을 나타내는 중립 표시, 손익의 좋음/나쁨과 색을 공유하지 않는다. unread 수·항목 수·기간은 서로 다른 label 문맥을 가진다. 일반 문장을 모두 badge에 넣지 않는다 |
| <a id="c-05"></a>C-05 · Icons | 반복 행동의 찾기 비용을 낮춘다 | down chevron=선택/펼침, right chevron=내부 상세, external arrow=실제 외부 이동. 같은 의미는 같은 아이콘. icon button은 accessible name과 focus를 제공한다. 장식 아이콘은 의미를 중복 낭독하지 않는다 |
| <a id="c-06"></a>C-06 · Metric / amount | 규모·변화와 그 근거를 읽는다 | 부호·금액·단위를 함께 표시하고 해당 범위/시각을 붙인다. 선택 가능한 값은 같은 focus/hover 패턴과 breakdown 목적지를 갖는다. 숨겨진 공식·수익률·환산을 만들지 않는다 |
| <a id="c-07"></a>C-07 · Table / record row | 같은 종류의 항목을 비교하고 하나를 조사한다 | 열은 사용자 질문 순서, 숫자는 우측 tabular 정렬. 현재값과 원래값은 label로 구분한다. row 선택과 내부 별도 버튼의 target을 분리한다. 선택한 행·정렬·필터를 복원한다 |
| <a id="c-08"></a>C-08 · Chart | 기간 중 변화의 형태와 근거를 확인한다 | 단위·기간·series 정의·정확한 관측시각을 제공한다. gap은 gap, 자금 이동은 이익으로 꾸미지 않는다. keyboard 선택 또는 동등한 자료 목록을 제공하며 hover만으로 조작하지 않는다 |
| <a id="c-09"></a>C-09 · Progress / meter | 알려진 전체 대비 실제 측정량을 읽는다 | 체결량/요청량과 잔량·시각을 제공한다. 한도 비교는 명시적 한도와 같은 측정 범위가 있을 때만 쓴다. 에이전트의 생각·업무 완료율을 임의 percentage로 만들지 않는다 |
| <a id="c-10"></a>C-10 · Person | 지속 구성원·저자·현재 책임을 알아본다 | 일관된 이름/아바타·책임·실제 관측을 함께 둔다. 아바타는 식별 보조, 모델/세션을 직원으로 표시하지 않는다. 선택은 member detail로 연결한다 |
| <a id="c-11"></a>C-11 · Artifact | 산출물의 실물과 검증 단계를 확인한다 | 타입·이름·작성자·업무·정확한 revision과 preview를 연결한다. Published/Verified/Accepted/Active/Observed는 각 근거로 구별한다. 꾸민 파일 카드가 실제 열기처럼 보이게 하지 않는다 |
| <a id="c-12"></a>C-12 · Detail / dialog | 상세 조사와 제어 검토를 분리한다 | 조사·제어 결과는 본문 전체와 복귀 경로를 사용하고 dialog는 필요한 집중 입력/검토에 한정한다. close/back/focus 복원, 하나의 상위 층을 보장한다. 확인할 필요가 없는 열람에 확인 dialog를 넣지 않는다 |
| <a id="c-13"></a>C-13 · Input / form | 정확한 값과 의도를 입력한다 | persistent label, 단위, 필요한 제약, 인접 validation, 입력 보존. placeholder가 label을 대신하지 않는다. 처리 중 중복 제출을 방지하고 접수 결과를 보여준다 |
| <a id="c-14"></a>C-14 · Notice / empty / tooltip | 판단에 필요한 예외와 부재의 의미를 안다 | 로컬 문제는 로컬, 전체 영향은 전역. brief reason + 실제 가능한 다음 행동. 처음 보는 사용자를 위해 모든 섹션에 설명 문단을 붙이지 않는다 |
| <a id="c-15"></a>C-15 · Surface / spacing / motion | 같은 목적을 묶고 선택·전환을 알아본다 | L-02 간격·정렬과 필요한 surface만 사용한다. 섹션 구분선·장식 카드의 반복을 피한다. 입력 경계·focus ring·차트의 정보선은 기능에 필요한 경우 유지한다. reduced motion을 따르고 가짜 활동 애니메이션을 만들지 않는다 |

### C-01의 현재 앱 역할

값은 [앱 recipes](../../apps/mac/src/ui/recipes.css)와 [생성 토큰](../../apps/mac/src/ui/tokens/openboa.css)에 바인딩한다.
역할은 font size / line-height / weight / tracking / width를 함께 갖는다. 아래 숫자는 size/line-height와 weight다.

| 역할 | 현재 값 | 사용 목적 |
| --- | --- | --- |
| `amount` | 28/36, 550 | 첫 질문에 답하는 대표 금액 한 묶음 |
| `amount-secondary` | 24/32, 550 | 대표 금액과 함께 비교하는 기간 결과 |
| `title` | 20/28, 550 | 현재 화면·상세의 정체성 |
| `section` | 14/20, 550 | 다른 질문이 시작되는 위치 |
| `body` | 14/20, 450 | 대화·판단 설명·입력의 주 읽기 내용 |
| `data` | 13/18, 450 | 표·행의 비교 가능한 값 |
| `control` | 13/16, 550 | 버튼·탭·명확한 조작 label |
| `meta` | 12/16, 450 | 출처·시각 등 보조 문맥. 중요한 금액·불확실성 대체용이 아님 |

현재 앱은 Mira 부품과 OpenBoa 전체 typography 역할을 같은 원본에서 사용한다. 대표 버튼 default/large는
28/32px이며 다른 크기는 공통 variants/recipes가 소유한다. 과거 Shell의 36px 기본값을 현재값으로 인용하지 않는다.
size/weight/line-height/tracking/width를 개별 화면에서 덮지 않고 token→recipe→composition으로 적용한다.
실제 화면·상태·키보드 검증은 [UI 구현 계약](UI_IMPLEMENTATION.md)과 실행 증거로 별도 판단한다.

<a id="coverage"></a>
## 10. 코드 연결과 현재 충족 범위

2026-09-14 사용자 시안 승인 후 구현 원본을 `apps/mac/src`로 통합했다.
[UI 구현 계약](UI_IMPLEMENTATION.md)은 토큰·부품·레이아웃·화면의 현재 파일과 의존성,
[앱 구현 체크포인트](../implementation/COMPANY_BOUNDARIES.md)은 실제 확인 범위를 명시한다.
`design/mac-calibration`은 같은 원본을 불러오는 개발 도구다.

현재 목적과 원본의 연결은 다음과 같다. 구현 위치이며 전 시나리오 인수 완료 선언은 아니다.

| 현재 원본 (`apps/mac/src/` 기준) | 목적 계약 / 현재 경계 |
| --- | --- |
| `app/Workspace.tsx`, `routes.ts`, `ui/layouts/WorkspaceLayout.tsx` | L/S/N-12: 고정 Workspace 7개, Company 구분, 단일 Settings와 본문 탭, 출처 배지, 본문 상세/복귀, 고정 Owner controls |
| `features/home/Home.tsx`, `layout.ts` | W-01–W-04: widget 선택과 scope별 개인 배치; 회사 게시·권한과 분리 |
| `features/operations/Operations.tsx`, `features/gateway/GatewayWorkspace.tsx` | O/N: Work/Agents/System와 허용된 실제 관측; 제공된 coverage만 표시 |
| `modules/CompanyPage.tsx`, `ModuleSettings.tsx`, `contracts/modules.ts` | W-05/N-09–N-11: 제품 host wrapper와 외부 package 계약 분리; 게시·선택·관측 상태, 고정 UI 변경 불가 |
| `features/conversations/`, `features/library/`, `data/`, `../src-tauri/src/main.rs` | R/A/T: 수신자, 저장/전달 구분, 정확한 파일·원래 제어 요청; 실제 Gateway 경로 |
| `features/notifications/`, `data/notifications.ts`, `ui/components/UnreadBadge.tsx`, `../src-tauri/src/main.rs` | NT-01–NT-04: 같은 서버 unread 집계, 명시한 ID 읽음 영수증, 원본 이동·scope 분리; 테스트 판정은 구현 기록에 별도 보존 |
| `modules/CompanySurface.tsx`, `../src-tauri/src/company_views.rs` | 독립 게시 패키지의 격리 표시; 회사 원본은 제품 체크아웃 밖에 보관 |

실제 회사 실행 자료는 비공개 보관 대상으로 분리했다. 현재 경계와 검증 한계는 [Company 경계 계약](../implementation/COMPANY_BOUNDARIES.md)을 따른다.

아래 표는 **이식 이전 v3 시안의 목적별 범위 기록**이다. 기존 경로는 공통 원본의 재노출 경로로
남아 있으며, 표의 당시 미구현 항목을 현재 앱 상태로 인용하지 않는다. 목적 ID 전체의 인수 완료는 아니다.

| 실제 파일 / 단위 | 목적 계약 | v3 구현·확인 범위 | 미구현 또는 별도 검증 |
| --- | --- | --- | --- |
| [App.tsx](../../design/mac-calibration/src/App.tsx) · `ProductScreen` | L/S 계열, P-01, S-11 | Portfolio·Company·Conversations·Library가 각각 실제 주 화면으로 이동한다. 하나의 Inspector와 상세 이력, 대화 참조·복귀, 고정 검색/연결/제어 진입을 제공한다 | 실제 회사 전환·인증·도메인 등록/실패 격리·Tauri 앱 이식. 상단 금융 요약도 로컬 샘플이며 공통/도메인 제품 분리 완료 증거가 아님 |
| [shared.tsx](../../apps/mac/src/ui/components/patterns.tsx) · `Amount`, `Member`, `RecordLink`, 상태/상세 부품 | C/S 계열, O-05, P-04/P-05 | 동일 type-role·상태·관측 문법을 네 composition에서 재사용한다. 자료 없음/지연/제한/미확정 표현을 샘플로 제공한다 | 실제 source authority·갱신·접근 제어. 프론트엔드의 숨김 조건은 서버 권한 검사 증거가 아님 |
| [Portfolio.tsx](../../apps/mac/src/domains/investment/Portfolio.tsx) | P-01–P-22 | 계정값/기간 손익/자금 이동·현재 노출을 분리한다. 7D/1D, P&L/Equity, 데이터 목록의 특정 관측 선택, 포지션·주문·판단·근거 상세와 대화를 연결했다 | 실제 계좌·시계열 조회, 전체 거래 이력/검색, 원본 관측별 구성 대조와 금융 제어. 차트는 명시적인 샘플 데이터 |
| [Company.tsx](../../apps/mac/src/development/CompanyPreview.tsx) | O-01–O-18 | 우선 업무·최근 변화, Atlas/Nova, 멤버 필터와 Work/Executions/Trace, 정상 대기·미관측·제한/빈 상태를 제공한다. 공개 도구/영수증 예시에서 정확한 Nova 실행 정지 검토로 이동한다 | 전체 활동 이력 검색, 실제 부모/자식 업무·책임 인계, 서버 관측, 실행 종료·자원 반환. 두 구성원은 업무 수요를 보여주는 샘플 |
| [Conversations.tsx](../../apps/mac/src/features/conversations/Conversations.tsx) | R 계열, S-08, C-13 | 개인/그룹 방·참여자, 검색/필터, 방별 초안·읽던 위치, 답장·제거 가능한 선택 참조, `Save locally`를 제공한다. 선택 파일→CEO 대화→원래 위치 복귀를 확인했다 | 서버 저장·수신자별 전달·실제 답변·읽음 영수증·wake/그룹 라우팅. 저장 예시는 `Not delivered`이며 새로고침하면 초안/로컬 메시지가 사라짐 |
| [Library.tsx](../../apps/mac/src/features/library/Library.tsx) | A 계열, C-07/C-11 | 세 샘플 파일을 이름·타입·작성자·업무·revision으로 찾고 선택한다. JSON/Markdown의 정확한 샘플 revision을 열고 관련 업무/대화로 연결한다 | 원격 검색·업로드/게시·이전 revision 탐색/비교·보존/정리. 하나의 파일에 여러 버전이 있는 전체 이력은 없음 |
| [InspectorContent.tsx](../../apps/mac/src/development/InspectorContent.tsx) | P/O/A 계열, S-04/S-09, T/N 계열 | 계정·손익·특정 관측·주문/체결·판단·구성원/업무/실행·파일·회사 비용·출처 상세를 제공한다. 원문/고정 참조, 샘플 파일 저장 코드, 허용된 샘플 검색, 대상이 명시된 비활성 제어/연결 검토가 있다 | 실제 DB/Catalog/Gateway 조회·게시 영수증 검증·명령. 파일 저장은 표시 중인 샘플 본문을 내보내는 코드이며 브라우저 다운로드 완료는 미확인 |
| [types.ts](../../apps/mac/src/app/contracts.ts) · `DetailTarget`, `ContextReference` | S-08/S-09 | 로컬 상세 대상·기간·선택 관측과 대화 참조를 composition 사이에 전달한다 | Gateway DTO나 권한/금융 스키마가 아님. 실제 API와 revision 계약의 연결은 제품 구현 과제 |
| [ComponentSpec.tsx](../../apps/mac/src/development/ComponentSpec.tsx), `App.tsx`의 `TypeSpec`, component recipes·composition CSS | S-10, C-01–C-15, L 계열 | 실제 shadcn Mira/Base UI 부품, OpenBoa 역할·테마·간격과 상태 비교를 제공한다. v3의 본문/상세 배치에 같은 기준을 적용했다 | 모든 창 크기·키보드 경로·접근성의 전체 인수. 컴포넌트 보드의 통과만으로 제품 경험을 승인하지 않음 |
| 시작·재연결·복구, 실제 기록/운영 연결 | B 계열, T/N 계열 | 이 시안의 완료 범위에서 분리했다. 연결·명령 불가를 화면에 명시한다 | 초기 설정·credential 등록·운영 개시·복구·실제 자율 운영·주문/실행 제어·버전 비교·인계는 완료하지 않음 |

**당시 v3 브라우저 확인 범위**는 네 주 화면, position/order/decision 상세, `position-review` revision 12의
실물 열기→CEO 대화→복귀, 공개 Trace→Nova의 정확한 정지 검토, 7D/1D 선택 관측과
delayed/restricted/empty/uncertain 예시다. 시안의 실제 명령 전송은 0회이며 UI 검토가 운영 검증을 대체하지 않는다.
Portfolio의 1440×900·1100×720 및 light/dark 화면, 1100px에서 네 주 화면의 가로 넘침 부재를 확인했다.
Escape와 상세 복귀를 확인했으며 전체 키보드·focus·화면 읽기와 큰 자료/긴 이름의 인수는 아직 남았다. 개별 확인 결과는
v3 QA 기록 (retained local evidence; excluded from product Git)과 [MAC_APP](../implementation/MAC_APP.md)을 기준으로 갱신한다.

구현 주석의 `UX:` 경로는 이 표 또는 요소 ID를 가리킨다. 주석은 설계의 중복 원본이 아니다.
새 요소는 부모의 질문을 강화하는지 먼저 확인하고 계약→구현→상태 예시→실제 화면 증거를 연결한다.
Generated shadcn 내부의 모든 DOM 노드에 제품 설명을 붙이지 않고 제품 composition에 목적을 남긴다.

## 11. 현재 구현의 인수 기준과 v3 증거 구분

아래는 지속하는 인수 기준이다. §10의 브라우저 부분 확인, 사용자 시안 승인, 실제 앱/API 검증은 서로 다른 단계다.

1. **목적과 이동:** 금액→구성 근거, position→order/fill/decision→정확한 artifact,
   선택 record→대화→원래 위치가 이어져야 한다. inert card와 가짜 선택기가 없어야 한다.
2. **정보 우선순위:** 현재 자본/기간 결과/자금 이동을 구별하고, 현재 노출과 미체결 잔량을
   재계산 없이 해석할 수 있어야 한다. margin을 손실 한도처럼 표현하지 않는다.
3. **상태와 조작:** zero/unknown/partial/stale/restricted/uncertain을 같은 패턴으로 확인한다.
   원래 요청 ID와 실제 적용·남은 의무가 보존돼야 한다.
4. **시각과 부품:** 역할별 type·spacing·색·아이콘·focus를 검토한다. `Long`은 중립,
   검색/선택/이동의 아이콘은 실제 행동과 일치해야 한다. 설명 문단을 추가해 실패를 덮지 않는다.
5. **실제 사용:** 1440×900·1100×720, 두 테마, 키보드, 큰 금액·긴 이름·빈 자료로 위 흐름을 실행한다.
   모든 주요 화면과 열리는 상세의 증거를 남긴다. 한국어 입력도 가능하되 제품 label은 영어다.

통과는 문서에 목적을 써 둔 상태가 아니다. 사용자가 설명 없이 필요한 답을 얻고 근거를 확인하며
정확한 대상에 행동하고 돌아오는 것을 실제 화면에서 확인해야 한다. 현재 v3의 확인·미확인 범위는
v3 QA 기록 (retained local evidence; excluded from product Git)에 남긴다.
v2 시안 목적 감사 (retained local evidence; excluded from product Git)는 재설계 이전의 역사적 기록이며,
그때의 미구현 목록을 현재 상태로 그대로 인용하지 않는다. 사용자 시안 승인은 2026-09-14의
“좋아 이걸로 앱 구현” 요청으로 확인했다. 앱/API의 전체 인수는 별도이며 현재 검증 범위를 따른다.

## 통합 시스템과 UX 인수 연결

[통합 시스템 설계](../architecture/SYSTEM_DESIGN.md)가 소유권, main-only source,
Package/Verification/Deployment, 환경·산출물 수명을 정의한다. 이 문서는 기존 목적 ID와
화면 안에서 그 사실을 어떻게 확인·조작하는지를 연결한다. 아래는 구현 완료 선언이 아니다.

| 흐름 | 기존 화면 / 필수 사용자 결과 |
| --- | --- |
| 프로필 변경 | 회사/구성원 이름은 독립 회사 데이터에서 갱신되고 UI package가 없거나 실패해도 기본 신원·관찰·제어가 남는다. 과거 principal/책임은 보존된다 |
| 회사 코드 변경 | Settings → Company/Modules에서 main commit·package·검증·현재 선택·실제 적용을 비교한다. source 통합을 즉시 운영으로 표시하지 않는다 |
| Company view 실패/교체 | 동일 앱에서 v1→v2를 확인하고, 잘못된 후보는 미적용된다. 실제 native hang에서도 고정 제어를 사용할 수 있는지 검증한다 |
| 자료 탐색과 질문 | Library에서 정확한 과거 버전·생성자/게시자·검증·사용/보존 이유를 확인하고 같은 참조로 Conversations에 이동·복귀한다 |
| 자율 운용 관찰 | Home/Work/Agents/System에서 사용자 작업 공급 없이 실제 판단·실행 또는 대기·평가·다음 조건을 확인한다. 빈 부서 카드는 필요 없다 |
| 금융 결과 확인 | 선택된 Company UI·서비스가 잔고·출자·손익·비용·주문/체결 근거를 연결한다. 일부/오래됨/미확정을 0이나 성공으로 표시하지 않는다. 서비스 부재를 제품 투자 구현으로 대체하지 않는다 |
| 알림과 제어 | Notifications와 메뉴는 같은 unread 근거를 쓴다. 읽음·대화의 동의 문구는 승인/해결이 아니다. 제어 접수와 실제 적용·잔여 의무를 구분한다 |
| 재연결·복구 | 이전 scope의 private surface/cache를 폐기하고 현재 권한을 조회한다. 창 닫기와 운영 중단을 구분하며 원래 intent를 대조한다 |

현재 Library의 실제 관측 한계와 코드 원본은 [Mac 체크포인트](../implementation/MAC_APP.md#current-checkpoint),
전체 인수 증거는 [통합 인수표](../architecture/SYSTEM_DESIGN.md#10-acceptance-across-the-full-lifecycle)를 따른다.


### System — original Company call recovery

고정 System 화면은 Company 업무의 실행·복구를 관찰하고 정확한 호출을 제한한다. 회사의 업무 화면이나
서비스 정상 여부를 대신 정의하지 않는다. 공통 `features/services`는 서버 관측 계약과 공통 토큰만 사용하며,
예시 호출 이름·데이터는 `development/fixtures/services.ts`에만 둔다.

| 요소 | 사용자의 목적 | 표현·행동 | 근거·제약 |
| --- | --- | --- | --- |
| Company calls 목록 | 어떤 호출에 개입이 필요한지 찾는다 | 업무·호출 이름, 실행/복구 상태, 자원 확인 문제, 남은 재시작 횟수를 같은 행에 놓는다. 행 전체로 상세를 연다 | work별 등록된 continuation만 조회한다. 미지원·조회 실패·등록 없음·일부 로딩을 구분한다. 검색은 로드한 범위에만 적용한다 |
| 상태 띠와 네 가지 지표 | 프로세스, 복구 한도, 건강 상태, 영수증을 혼동하지 않는다 | 현재 실행, 원래 재시작 한도, 미측정 건강 상태, 자원 영수증 수를 따로 표시한다 | 프로세스 실행/종료·선택 일치·영수증 존재를 사업 성공이나 의무 정산으로 바꾸지 않는다 |
| Required resources | 무엇이 변경되거나 제한되어 있는지 확인한다 | 대상별 선택 일치 여부와 원래 호출자의 현재 권한, 입력 보존 수를 표시한다 | 비밀·configuration·payload를 노출하지 않는다. 서비스 자체의 모든 하위 권한, 가용성 검사나 전용 자원 예약을 입증하지 않는다 |
| Execution history / Resource effects | 이전 실행과 지금 남은 결과를 추적한다 | 원래 호출 아래 실행 ordinal과 자원 intent를 유지하며 원본 상세로 이동한다 | 실행 교체가 새 업무 결과나 새 effect를 의미하지 않는다. 미확정 결과를 숨기지 않는다 |
| Recovery policy | 자동 복구의 끝과 자원 반환 여부를 안다 | 기존 한도·만료 시각·반환 관측·허용된 firm compute 범위를 우측에 모은다 | 표시값으로 정책을 생성·연장하지 않는다. 미반환과 never-dispatched를 구분한다 |
| Stop call & recovery | 선택한 호출의 현재 실행과 복구를 제한한다 | 정확한 실행 ID와 요청 키를 먼저 보존하고 클릭 시 제출한다. 접수와 종료·반환은 별도 표시한다 | 응답 유실/재연결은 원래 요청 조회만 한다. 확정 거절된 요청은 명시적인 대상 재검토 뒤 새 요청을 만들 수 있다. 미확정 요청은 폐기하지 않는다 |
| Discuss / references | 맥락을 설명받고 필요할 때 정확한 식별자를 찾는다 | 호출 참조를 CEO 대화에 연결하고 원시 ID는 접힌 진단 영역에 둔다 | 대화가 제어 요청이나 정산 기록을 대신하지 않는다. 개발 샘플의 제어는 비활성이다 |

레이아웃은 목록 → 전체 상세로 이어진다. 기존 System 탭과 공통 탐색을 재사용하고 새 최상위 메뉴를 만들지 않는다.
텍스트는 의미별 typography role을 사용하고, 상태 구분은 문구·기호와 배경/여백을 함께 사용한다.
