// 소셜 로그인 실패 문구·시간 제한 테스트 (AUTH-01, AUTH-05 / NF-19)
// 실행: npm run test:oauth
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { NOT_LINKED_MESSAGE, socialErrorKind, socialErrorMessage } from "../src/lib/social-errors";
import { fetchJsonWithTimeout, OAUTH_FETCH_TIMEOUT_MS } from "../src/server/oauth-timeout";

let failed = 0;
function expect(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
}

const login = (code: unknown, provider?: string) => socialErrorMessage(code, { place: "login", provider })?.text ?? null;
const link = (code: unknown, provider?: string) => socialErrorMessage(code, { place: "link", provider })?.text ?? null;

// ── 코드 → 문구 (첫 화면 로그인) ──
expect("코드 없음 → 문구 없음", login(undefined), null);
expect("빈 코드 → 문구 없음", login(""), null);
expect("배열(?error=a&error=b) → 문구 없음", login(["a", "b"]), null);
for (const code of ["signup_disabled", "account_not_linked", "email_not_found"]) expect(`${code} → 연동 없음`, login(code, "kakao"), NOT_LINKED_MESSAGE);
expect("access_denied → 취소 안내", login("access_denied", "naver"), "로그인을 취소했어요");
expect("access_denied는 부드러운 안내(info)", socialErrorMessage("access_denied", { place: "login" })?.tone, "info");
for (const code of ["state_not_found", "state_mismatch", "state_invalid", "invalid_callback_request", "no_code"])
  expect(`${code} → 시간 지남`, login(code), "로그인 시간이 지났어요. 다시 시도해 주세요");
expect("state_mismatch는 경고(error)", socialErrorMessage("state_mismatch", { place: "login" })?.tone, "error");
expect("invalid_code + kakao → 카카오", login("invalid_code", "kakao"), "카카오에서 정보를 못 받았어요. 잠시 뒤 다시 시도해 주세요");
expect("unable_to_get_user_info + naver → 네이버", login("unable_to_get_user_info", "naver"), "네이버에서 정보를 못 받았어요. 잠시 뒤 다시 시도해 주세요");
expect("unable_to_get_user_info + google → Google", login("unable_to_get_user_info", "google"), "Google에서 정보를 못 받았어요. 잠시 뒤 다시 시도해 주세요");
expect("서비스 모름 → 소셜 서비스", login("invalid_code", "evil<script>"), "소셜 서비스에서 정보를 못 받았어요. 잠시 뒤 다시 시도해 주세요");
expect("server_error → 서비스 응답 없음", socialErrorKind("server_error"), "provider");
expect("모르는 코드 → 일반 문구", login("x"), "로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요");
expect("모르는 코드의 글자를 그대로 옮기지 않음", login("<b>hi</b>")?.includes("hi"), false);

// ── 코드 → 문구 (회원정보 수정 연동) ──
expect("다른 회원에 연동됨", link("account_already_linked_to_different_user", "kakao"), "이미 다른 Blogville 계정에 연동된 카카오 계정이에요");
expect("연동 취소", link("access_denied", "google"), "연동을 취소했어요");
expect("연동 시간 지남", link("state_mismatch", "kakao"), "연동 시간이 지났어요. 다시 시도해 주세요");
expect("연동 중 정보 못 받음", link("unable_to_get_user_info", "kakao"), "카카오에서 정보를 못 받았어요. 잠시 뒤 다시 시도해 주세요");
expect("unable_to_link_account", link("unable_to_link_account", "naver"), "네이버 계정을 연동하지 못했어요. 잠시 뒤 다시 시도해 주세요");
expect("연동 모르는 코드", link("x"), "연동하지 못했어요. 잠시 뒤 다시 시도해 주세요");

// ── 시간 제한 (로컬 서버: 응답하지 않는 주소 / 바로 응답하는 주소) ──
expect("제한 시간 3분", OAUTH_FETCH_TIMEOUT_MS, 180_000);
async function timeoutTests() {
  const server: Server = createServer((req, res) => {
    if (req.url === "/slow") return; // 영원히 응답하지 않는다
    if (req.url === "/redirect") return res.writeHead(302, { location: "/ok" }).end();
    if (req.url === "/fail") return res.writeHead(400, { "content-type": "application/json" }).end('{"error":"invalid_grant"}');
    res.writeHead(200, { "content-type": "application/json" }).end('{"access_token":"t"}');
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  {
    const t0 = Date.now();
    const err = await fetchJsonWithTimeout(`${base}/slow`, {}, 300).then(() => null, (e: Error) => e.name);
    const ms = Date.now() - t0;
    expect("응답 없는 서버 → TimeoutError", err, "TimeoutError");
    expect("제한 시간 근처에서 끊김 (300ms → 1초 안)", ms >= 250 && ms < 1000, true);
  }
  expect("바로 응답 → JSON", await fetchJsonWithTimeout(`${base}/ok`, {}, 300), { access_token: "t" });
  expect("400 → 던짐", await fetchJsonWithTimeout(`${base}/fail`, {}, 300).then(() => "ok", () => "throw"), "throw");
  expect("리다이렉트는 따라가지 않고 던짐", await fetchJsonWithTimeout(`${base}/redirect`, {}, 300).then(() => "ok", () => "throw"), "throw");
  server.closeAllConnections();
  server.close();
}

timeoutTests().then(() => {
  if (failed) process.exit(1);
});
