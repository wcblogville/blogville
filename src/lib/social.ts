// 소셜 서비스 목록과 화면 이름 (AUTH-01, AUTH-05 / FR-030, FR-036). 서버·클라이언트 모두에서 쓴다
export const SOCIAL_PROVIDERS = ["kakao", "naver", "google"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const isSocialProvider = (v: unknown): v is SocialProvider => SOCIAL_PROVIDERS.includes(v as SocialProvider);

/** 화면에 쓰는 서비스 이름 (첫 화면 버튼 FR-030과 같게) */
export const SOCIAL_LABEL: Record<SocialProvider, string> = { kakao: "카카오", naver: "네이버", google: "Google" };

/** 서비스마다 키(Client ID·Secret)가 준비됐는지. 키가 없는 서비스의 버튼은 비활성 (FR-031) */
export type SocialReady = Record<SocialProvider, boolean>;
