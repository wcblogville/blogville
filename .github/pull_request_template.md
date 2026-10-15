## 무엇을 바꿨나요?
<!-- 한두 줄로 -->
- **Before**: 
- **After**: 
- **How**: 

## 관련 Issue
<!-- 예: Closes #2  (merge되면 Issue가 자동으로 닫혀요) -->

## 확인
- [ ] git flow 브랜치예요: `feature/*` → `develop` / `release/*`·`hotfix/*` → `main` (`main`·`develop`에 직접 push하지 않아요)
- [ ] 아래 **검사**(CI: 코드 검사·빌드·E2E)가 초록색이에요
- [ ] 비밀값(`.env.local`, 비밀번호, API 키)이 들어 있지 않아요
- [ ] (요구사항 문서) 4.0 작성 양식을 따랐고, 변경 이력에 한 줄 추가했어요
- [ ] (코드) `npx tsc --noEmit`, `npx eslint`, `npm test` 통과
- [ ] (테스트) 규칙·계산은 `scripts/test-*.ts`에 단위 테스트, 회원이 하는 흐름은 `e2e/`에 시험을 더했고, 맨 위 주석에 요구사항 ID를 적었어요
- [ ] (테스트) `npm run test:trace`로 요구사항 ↔ 테스트 연결표(`docs/04-test-trace.md`)를 다시 만들었어요
- [ ] (테스트) 새 E2E는 `e2e/suites.json`의 `ci`(PR마다) 또는 `nightly`(매일 밤)에 넣었어요 ([테스트 전략](../docs/03-test-strategy.md))
- [ ] (화면) 바뀐 화면을 직접 확인했어요 (스크린샷 첨부하면 좋아요)

## 리뷰어에게
<!-- 특히 봐 줬으면 하는 부분, 함께 정하고 싶은 열린 질문 -->

---
리뷰: 작성자가 아닌 팀원 1명 이상 **Approve** → merge는 ehgo508 ([협업 가이드](https://github.com/ehgo508/blogville/blob/main/CONTRIBUTING.md))
