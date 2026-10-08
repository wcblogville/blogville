// Blogville DB 스키마 — docs/02-erd.md 설계를 그대로 옮긴 것
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ===== 열거형 =====
// avatar(모자·옷·소품)·growth(동물 성장 아이템)는 SHOP-01·SHOP-06에서 뒤에 더했다
export const itemType = pgEnum("item_type", ["character", "background", "furniture", "avatar", "growth"]);
// 아바타 꾸미기 부위 (SHOP-06)
export const avatarSlot = pgEnum("avatar_slot", ["hat", "outfit", "accessory"]);
export const visibility = pgEnum("visibility", ["public", "private"]);
export const userRole = pgEnum("user_role", ["user", "admin"]);
export const notificationKind = pgEnum("notification_kind", ["level_up", "like", "comment", "reply"]);
export const ledgerReason = pgEnum("ledger_reason", [
  "signup",
  "attendance",
  "attendance_streak",
  "post",
  "comment",
  "like_received",
  "purchase",
  "farm_care",
  "farm_grown",
  "egg_purchase",
  "fishing",
]);
// 동물 농장 (TOWN-09)
export const animalStatus = pgEnum("animal_status", ["egg", "growing", "grown"]);
export const eggSource = pgEnum("egg_source", ["starter", "level", "shop"]);
export const careAction = pgEnum("care_action", ["feed", "water", "pet"]);

// ===== 인증 (Better Auth가 요구하는 구조) =====
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    // 라이브러리 필수 칸. 가입 때 `{아이디}@users.blogville.invalid` (메일을 보내지 않고 화면에 나오지 않는다)
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // 사이트 아이디: 모든 회원이 가진다. 소문자만 저장하므로 UNIQUE가 곧 대소문자 무시 유일 (AUTH-07 / FR-002, FR-003)
    username: text("username").notNull().unique(),
    displayUsername: text("display_username"),
    role: userRole("role").notNull().default("user"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("users_username_check", sql`${t.username} ~ '^[a-z0-9_]{4,20}$'`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    // 마지막 사용(근사). 유지 안 함 세션은 이 값이 2시간보다 오래되면 expires_at과 상관없이 끝난다 (AUTH-09 / FR-020, src/server/dal.ts)
    updatedAt: updatedAt(),
    // [로그인 상태 유지] 여부. 서버는 쿠키가 아니라 이 칸으로 2시간/7일을 정한다 (AUTH-09 / FR-019~FR-021, research R6)
    rememberMe: boolean("remember_me").notNull().default(false),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

// 로그인 실패 기록: 아이디별 연속 실패 수와 잠금 해제 시각 (AUTH-09 / FR-025~FR-027, research R8)
// 없는 아이디도 기록하므로 users와 FK가 없다 (FK가 있으면 아이디 존재 여부가 드러난다). 규칙 숫자는 src/lib/login-limit.ts
export const loginAttempts = pgTable(
  "login_attempts",
  {
    username: text("username").primaryKey(), // 정규화한 입력 그대로
    failedCount: integer("failed_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("login_attempts_username_check", sql`char_length(${t.username}) BETWEEN 1 AND 64`),
    check("login_attempts_failed_count_check", sql`${t.failedCount} >= 0`),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(), // naver / kakao / google
    accountId: text("account_id").notNull(), // 소셜 서비스 쪽 사용자 ID
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("accounts_user_id_idx").on(t.userId),
    // 같은 소셜 계정이 두 회원에 연결될 수 없다 (FR-038)
    unique("accounts_provider_account_uq").on(t.providerId, t.accountId),
    // 한 회원은 서비스마다 로그인 수단 1개 (아이디 로그인 1개 + 카카오·네이버·구글 각 1개, FR-039).
    // 두 탭에서 동시에 연동해도 DB가 막는다
    unique("accounts_user_provider_uq").on(t.userId, t.providerId),
  ],
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ===== 아이템 =====
export const items = pgTable(
  "items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: text("code").notNull().unique(),
    type: itemType("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    price: integer("price").notNull().default(0),
    requiredLevel: integer("required_level").notNull().default(1),
    isStarter: boolean("is_starter").notNull().default(false), // 가입 시 고를 수 있는 기본 아이템
    assetKey: text("asset_key").notNull(),
    // 아바타 꾸미기만 부위가 있다 (SHOP-06)
    avatarSlot: avatarSlot("avatar_slot"),
    // 성장 아이템을 하나 쓸 때 자라는 양 (SHOP-01 2026-10-07, TOWN-09)
    growthValue: integer("growth_value"),
    // 상점 목록·구매 가능 여부. 캐릭터·기본 아이템은 false (SHOP-01, D12). 판매를 멈춰도 가진 사람은 계속 쓴다
    isOnSale: boolean("is_on_sale").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    check("items_price_check", sql`${t.price} >= 0`),
    check("items_required_level_check", sql`${t.requiredLevel} >= 1`),
    // 새 열거형 값은 같은 마이그레이션 안에서 글자로 비교한다 (research R2)
    check("items_avatar_slot_check", sql`(${t.type}::text = 'avatar') = (${t.avatarSlot} IS NOT NULL)`),
    check("items_growth_type_check", sql`(${t.type}::text = 'growth') = (${t.growthValue} IS NOT NULL)`),
    check("items_growth_value_check", sql`${t.growthValue} IS NULL OR ${t.growthValue} > 0`),
  ],
);

// 회원 ↔ 아이템 (N:M): 보유 목록
export const userItems = pgTable(
  "user_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
    // 보유 수량 (SHOP-01). 꾸미기 아이템은 늘 1, 성장 아이템은 살 때 +1·쓸 때 −1. 0이어도 행은 남고 "보유"는 quantity > 0
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] }), check("user_items_quantity_check", sql`${t.quantity} >= 0`)],
);

// 아바타 착용 (SHOP-06): 회원·부위마다 하나, 가진 것만 (복합 FK)
export const avatarEquips = pgTable(
  "avatar_equips",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slot: avatarSlot("slot").notNull(),
    itemId: integer("item_id").notNull(),
    equippedAt: timestamp("equipped_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.slot] }),
    foreignKey({
      name: "avatar_equips_owned_fk",
      columns: [t.userId, t.itemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }).onDelete("cascade"),
  ],
);

// ===== 회원 프로필 · 블로그 =====
// 프로필: 가입 때 회원·블로그와 함께 생긴다 (AUTH-01, 한 트랜잭션 — src/server/signup.ts)
export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull().unique(),
    characterItemId: integer("character_item_id").notNull(),
    // 프로필 사진 (ERD 3.9). 올리는 화면은 아직 없다. 첨부 행이 지워지면 사진만 비운다 (ON DELETE SET NULL)
    photoKey: text("photo_key"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "profiles_photo_key_fk",
      columns: [t.photoKey],
      foreignColumns: [attachments.key],
    }).onDelete("set null"),
    check("profiles_nickname_check", sql`char_length(${t.nickname}) BETWEEN 2 AND 20`),
    // 보유한 아이템만 장착할 수 있다 (복합 외래 키)
    foreignKey({
      name: "profiles_character_owned_fk",
      columns: [t.userId, t.characterItemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }),
  ],
);

export const blogs = pgTable(
  "blogs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id")
      .notNull()
      .unique() // 회원당 블로그 1개 (1:1)
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    backgroundItemId: integer("background_item_id").notNull(),
    // 집 지붕 색 (TOWN-07 요청, BLOG data-model 2.1). NULL = 배경 색 따라가기. 값 목록은 src/lib/blog.ts ROOF_COLORS
    roofColor: text("roof_color"),
    // 전시 동물 한 마리 (BLOG-04 / FR-030·031, data-model 2.1). NULL = 전시 없음. 다 키운 동물만인지는 앱이 확인 (research R-19)
    showcaseAnimalId: integer("showcase_animal_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("blogs_slug_check", sql`${t.slug} ~ '^[a-z0-9_]{3,20}$'`),
    check("blogs_title_check", sql`char_length(${t.title}) BETWEEN 1 AND 40`),
    // 소개 0~160자 (BLOG-03 / FR-016, research R-23)
    check("blogs_description_check", sql`char_length(${t.description}) <= 160`),
    // 지붕 색은 8색 코드값만 (ROOF_COLORS와 같게, research R-22)
    check(
      "blogs_roof_color_check",
      sql`${t.roofColor} IS NULL OR ${t.roofColor} IN ('red', 'orange', 'yellow', 'green', 'sky', 'blue', 'purple', 'brown')`,
    ),
    foreignKey({
      name: "blogs_background_owned_fk",
      columns: [t.ownerId, t.backgroundItemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }),
    // 내 동물만 전시 (복합 FK, ERD 3.11, research R-18). 동물이 지워지면 showcase_animal_id만 비운다:
    // Drizzle은 열 목록을 적을 수 없어 생성 SQL을 ON DELETE SET NULL ("showcase_animal_id")로 손질함
    // (열 목록 없는 SET NULL은 NOT NULL인 owner_id까지 비우려 해 실패한다, PostgreSQL 15+)
    foreignKey({
      name: "blogs_showcase_owned_fk",
      columns: [t.ownerId, t.showcaseAnimalId],
      foreignColumns: [userAnimals.userId, userAnimals.id],
    }).onDelete("set null"),
  ],
);

// 집 안 가구 (마을 개편 2차, 사용자 요청 2026-10-08). 블로그의 "우리 집" 구역에 칸(slot)마다 가구 하나.
// 칸 수는 집 단계(주인 레벨)로 정한다: 1단계 4칸, 2단계 6칸, 3단계 8칸 (src/lib/house.ts). 가진 가구만, 같은 가구는 한 칸에만
export const houseFurniture = pgTable(
  "house_furniture",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    itemId: integer("item_id").notNull(),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.slot] }),
    unique("house_furniture_item_uq").on(t.userId, t.itemId),
    check("house_furniture_slot_check", sql`${t.slot} BETWEEN 0 AND 7`),
    foreignKey({
      name: "house_furniture_owned_fk",
      columns: [t.userId, t.itemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }).onDelete("cascade"),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    unique("categories_blog_name_uq").on(t.blogId, t.name),
    check("categories_name_check", sql`char_length(${t.name}) BETWEEN 1 AND 20`),
  ],
);

// 소분류 (BLOG-05 / FR-034~039, ERD 3.18, data-model 2.3). 대분류가 지워지면 함께 지워진다.
// blog_id는 두지 않는다 (대분류로 안다). 소분류를 다른 대분류로 옮기는 기능은 없다
export const subcategories = pgTable(
  "subcategories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    check("subcategories_name_check", sql`char_length(${t.name}) BETWEEN 1 AND 20`),
    // 같은 대분류 안에서 이름 하나 (US5-4)
    unique("subcategories_category_name_uq").on(t.categoryId, t.name),
    // posts 복합 FK (category_id, subcategory_id)의 대상: "소분류는 그 대분류 소속"을 DB가 확인 (FR-041, post 단계 3)
    unique("subcategories_category_id_uq").on(t.categoryId, t.id),
  ],
);

// ===== 글 · 교류 =====
export const posts = pgTable(
  "posts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    // 소분류 (POST-03 / FR-030, data-model 2.1). 복합 FK로 "고른 대분류 소속"을 DB가 확인한다
    subcategoryId: integer("subcategory_id"),
    title: text("title").notNull(),
    contentHtml: text("content_html").notNull(),
    contentText: text("content_text").notNull(), // 태그를 뺀 본문: 요약, 검색, 글자 수 확인용
    visibility: visibility("visibility").notNull().default("public"),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("posts_title_check", sql`char_length(${t.title}) BETWEEN 1 AND 100`),
    check("posts_view_count_check", sql`${t.viewCount} >= 0`),
    // 소분류만 있는 글은 없다 (POST-03 / FR-030)
    check("posts_subcategory_check", sql`${t.subcategoryId} IS NULL OR ${t.categoryId} IS NOT NULL`),
    // 소분류가 지워지면 글의 소분류만 비운다. drizzle은 SET NULL (컬럼)을 못 적어 마이그레이션에서 손으로 고쳤다 (research R5)
    foreignKey({
      name: "posts_subcategory_fk",
      columns: [t.categoryId, t.subcategoryId],
      foreignColumns: [subcategories.categoryId, subcategories.id],
    }).onDelete("set null"),
    index("posts_blog_created_idx").on(t.blogId, t.createdAt.desc()),
    index("posts_visibility_created_idx").on(t.visibility, t.createdAt.desc()),
  ],
);

export const tags = pgTable("tags", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
});

// 글 ↔ 태그 (N:M)
export const postTags = pgTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index("post_tags_tag_idx").on(t.tagId)],
);

export const comments = pgTable(
  "comments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    // 탈퇴하면 NULL (남의 답글이 달린 댓글만 `삭제된 댓글이에요` 자리로 남는다, SOC-02)
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // 답글이 남도록 행은 지우지 않고 내용만 비운다
  },
  (t) => [
    check(
      "comments_content_check",
      sql`(${t.deletedAt} IS NULL AND char_length(${t.content}) BETWEEN 1 AND 1000) OR (${t.deletedAt} IS NOT NULL AND ${t.content} = '')`,
    ),
    // 작성자가 없는(탈퇴) 댓글은 삭제 자리뿐이다. 정리 없이 회원을 지우면 이 CHECK가 막는다 (data-model 7)
    check("comments_author_check", sql`${t.authorId} IS NOT NULL OR ${t.deletedAt} IS NOT NULL`),
    index("comments_post_created_idx").on(t.postId, t.createdAt),
  ],
);

// 댓글 ↔ 답글 (1단계만, SOC-02). 원댓글이 지워져도(삭제 표시) 답글은 남는다
export const replies = pgTable(
  "replies",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    commentId: integer("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "replies_content_check",
      sql`(${t.deletedAt} IS NULL AND char_length(${t.content}) BETWEEN 1 AND 1000) OR (${t.deletedAt} IS NOT NULL AND ${t.content} = '')`,
    ),
    index("replies_comment_created_idx").on(t.commentId, t.createdAt),
  ],
);

// 글 ↔ 공감한 회원 (N:M): 한 글에 한 번만
export const postLikes = pgTable(
  "post_likes",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

// 회원 ↔ 회원 (자기 참조 N:M): 이웃
export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 즐겨찾는 이웃 (TOWN-08이 바꾸고, 이웃 새 글에서 최근 7일 글을 맨 위로, SOC-04)
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    check("follows_not_self_check", sql`${t.followerId} <> ${t.followeeId}`),
    index("follows_followee_idx").on(t.followeeId),
  ],
);

// ===== 보상 =====
// 일차별 출석 보상표 (GAME-04 / FR-020). 숫자를 바꾸려면 데이터 마이그레이션으로 고친다
export const attendanceRewards = pgTable(
  "attendance_rewards",
  {
    day: integer("day").primaryKey(),
    exp: integer("exp").notNull(),
    coins: integer("coins").notNull(),
  },
  (t) => [
    check("attendance_rewards_day_check", sql`${t.day} BETWEEN 1 AND 7`),
    check("attendance_rewards_exp_check", sql`${t.exp} >= 0`),
    check("attendance_rewards_coins_check", sql`${t.coins} >= 0`),
    check("attendance_rewards_nonzero_check", sql`${t.exp} > 0 OR ${t.coins} > 0`),
  ],
);

// 기본 키 (user_id, date) → 하루에 한 번만 출석. 로그인한 채 그날 첫 화면을 열면 자동으로 생긴다 (GAME-04)
export const attendances = pgTable(
  "attendances",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    cycleDay: integer("cycle_day")
      .notNull()
      .references(() => attendanceRewards.day),
    // 출석이 일어난 세션. 로그아웃·만료로 세션이 지워져도 출석은 남는다
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date] }),
    check("attendances_cycle_day_check", sql`${t.cycleDay} BETWEEN 1 AND 7`),
    index("attendances_session_idx").on(t.sessionId),
  ],
);

// 경험치·코인 원장: 잔액은 저장하지 않고 합계로 계산한다
export const pointLedger = pgTable(
  "point_ledger",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: ledgerReason("reason").notNull(),
    expDelta: integer("exp_delta").notNull().default(0),
    coinDelta: integer("coin_delta").notNull().default(0),
    refId: text("ref_id"), // 관련 글·댓글·아이템 ID
    createdAt: createdAt(),
  },
  (t) => [
    check("point_ledger_exp_check", sql`${t.expDelta} >= 0`),
    check("point_ledger_nonzero_check", sql`${t.expDelta} <> 0 OR ${t.coinDelta} <> 0`),
    index("point_ledger_user_reason_created_idx").on(t.userId, t.reason, t.createdAt),
    index("point_ledger_user_created_idx").on(t.userId, t.createdAt.desc()), // 내역 화면 최신순 (GAME-07)
    // 같은 사람·같은 글 공감 보상은 1번 (ref_id = "글ID:공감한 회원ID", SOC-03 / FR-029, 원칙 V)
    // 출석 보상은 하루 한 번 (ref_id = 출석 날짜, GAME-04 / FR-047)
    uniqueIndex("point_ledger_attendance_uq").on(t.userId, t.refId).where(sql`${t.reason} = 'attendance'`),
    uniqueIndex("point_ledger_like_received_uq").on(t.userId, t.refId).where(sql`${t.reason} = 'like_received'`),
  ],
);

// 알림 (GAME-06·GAME-08): 레벨업 · 공감 · 댓글 · 답글. 닉네임·글 제목은 저장하지 않고 보여 줄 때 JOIN으로 읽는다
export const notifications = pgTable(
  "notifications",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id") // 받는 회원
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "cascade" }), // 행동한 회원 (레벨업은 NULL)
    postId: integer("post_id").references(() => posts.id, { onDelete: "cascade" }), // 관련 글 (레벨업은 NULL)
    level: integer("level"), // 레벨업일 때 오른 레벨
    createdAt: createdAt(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "notifications_shape_check",
      sql`(${t.kind} = 'level_up' AND ${t.level} IS NOT NULL AND ${t.actorId} IS NULL AND ${t.postId} IS NULL) OR (${t.kind} <> 'level_up' AND ${t.level} IS NULL AND ${t.actorId} IS NOT NULL AND ${t.postId} IS NOT NULL)`,
    ),
    check("notifications_level_check", sql`${t.level} IS NULL OR ${t.level} BETWEEN 2 AND 99`),
    check("notifications_not_self_check", sql`${t.actorId} IS NULL OR ${t.actorId} <> ${t.userId}`),
    // 레벨업 알림은 회원·레벨마다 한 번 (FR-037)
    uniqueIndex("notifications_level_up_uq").on(t.userId, t.level).where(sql`${t.kind} = 'level_up'`),
    index("notifications_user_created_idx").on(t.userId, t.createdAt.desc(), t.id.desc()),
    index("notifications_unread_idx").on(t.userId).where(sql`${t.readAt} IS NULL`),
    index("notifications_post_idx").on(t.postId).where(sql`${t.postId} IS NOT NULL`),
  ],
);

// ===== 동물 농장 (TOWN-09) =====
// 동물 종류 카탈로그. 다 자라는 데 필요한 성장치와 다 키웠을 때 보상이 종류마다 다르다
export const animalSpecies = pgTable(
  "animal_species",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    assetKey: text("asset_key").notNull(),
    growExp: integer("grow_exp").notNull(), // 다 자라는 데 필요한 성장치
    rewardExp: integer("reward_exp").notNull(), // 다 키웠을 때 받는 경험치
    rewardCoins: integer("reward_coins").notNull(),
    hatchWeight: integer("hatch_weight").notNull(), // 알에서 나올 확률 비중 (클수록 흔함)
  },
  (t) => [
    check("animal_species_grow_check", sql`${t.growExp} > 0`),
    check("animal_species_reward_check", sql`${t.rewardExp} >= 0 AND ${t.rewardCoins} >= 0`),
    check("animal_species_weight_check", sql`${t.hatchWeight} > 0`),
  ],
);

// 회원이 가진 알·동물. 알일 때는 종류가 정해지지 않았다가 부화할 때 랜덤으로 정해진다
export const userAnimals = pgTable(
  "user_animals",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    speciesId: integer("species_id").references(() => animalSpecies.id),
    status: animalStatus("status").notNull().default("egg"),
    growth: integer("growth").notNull().default(0),
    source: eggSource("source").notNull(),
    sourceLevel: integer("source_level"), // 레벨 보상 알이면 몇 레벨 보상인지
    createdAt: createdAt(),
    hatchedAt: timestamp("hatched_at", { withTimezone: true }),
    grownAt: timestamp("grown_at", { withTimezone: true }),
  },
  (t) => [
    check("user_animals_species_check", sql`(${t.status} = 'egg') = (${t.speciesId} IS NULL)`),
    check("user_animals_growth_check", sql`${t.growth} >= 0`),
    check("user_animals_level_check", sql`(${t.source} = 'level') = (${t.sourceLevel} IS NOT NULL)`),
    // 첫 알은 한 번, 레벨 보상 알은 레벨마다 한 번만
    uniqueIndex("user_animals_starter_uq").on(t.userId).where(sql`${t.source} = 'starter'`),
    uniqueIndex("user_animals_level_uq").on(t.userId, t.sourceLevel).where(sql`${t.source} = 'level'`),
    index("user_animals_user_status_idx").on(t.userId, t.status),
    // 블로그 전시 동물 복합 FK(blogs_showcase_owned_fk)가 가리킬 UNIQUE (town T-M1, 요청: blog BLOG-04, ERD 3.11).
    // id가 PK라 늘 고유하다. 부분 고유 인덱스는 FK 대상이 될 수 없어 따로 둔다
    unique("user_animals_user_id_id_uq").on(t.userId, t.id),
  ],
);

// 돌보기 기록: 동물 한 마리에 같은 돌보기는 하루 한 번
export const animalCares = pgTable(
  "animal_cares",
  {
    animalId: integer("animal_id")
      .notNull()
      .references(() => userAnimals.id, { onDelete: "cascade" }),
    action: careAction("action").notNull(),
    date: date("date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.animalId, t.action, t.date] })],
);

// 연못 낚시터: 회원마다 하루(한국 날짜) 한 번 (사용자 요청 2026-10-08). 무엇을 낚았는지는 src/lib/fishing.ts의 key
export const fishingCatches = pgTable(
  "fishing_catches",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    catchKey: text("catch_key").notNull(),
    coins: integer("coins").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] }), check("fishing_catches_coins_check", sql`${t.coins} >= 0`)],
);

// 글 첨부(사진·파일) 정보. 파일 내용은 DB가 아니라 저장소(src/server/storage.ts)에 둔다 (POST-07, POST-09)
export const attachments = pgTable(
  "attachments",
  {
    key: text("key").primaryKey(), // 서버가 만든 무작위 32자. 저장 이름이자 주소(/files/키)
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // image | file
    name: text("name").notNull(), // 올린 사람이 붙인 원래 파일 이름 (내려받을 때 이 이름으로)
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    // 붙은 글 (POST-07·POST-09 / FR-047). NULL이면 어느 글에도 붙지 않음 → 올린 사람만 열고, 하루 뒤 정리된다 (FR-059)
    postId: integer("post_id").references(() => posts.id, { onDelete: "set null" }),
    // 글에서 떨어진 시각. 붙어 있거나 한 번도 안 붙었으면 NULL (트리거 attachments_track_detached, research R7)
    detachedAt: timestamp("detached_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("attachments_kind_check", sql`${t.kind} IN ('image', 'file')`),
    check("attachments_key_check", sql`${t.key} ~ '^[a-f0-9]{32}$'`),
    check("attachments_name_check", sql`char_length(${t.name}) BETWEEN 1 AND 255`),
    check("attachments_size_check", sql`${t.size} > 0`),
    index("attachments_user_created_idx").on(t.userId, t.createdAt),
    index("attachments_post_idx").on(t.postId),
  ],
);

// 블로그 방문자 (BLOG-06): 같은 사람(쿠키 bv_visitor)은 한 블로그에 하루(한국 시간) 1줄. IP는 저장하지 않는다
export const blogVisits = pgTable(
  "blog_visits",
  {
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    date: date("date").notNull(), // 한국 날짜 (todayKST)
    visitorId: uuid("visitor_id").notNull(), // 방문자 쿠키 값 (회원 정보와 연결하지 않음)
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blogId, t.date, t.visitorId] })],
);

// 글 조회 기록 (POST-06 / FR-046, data-model 4): 같은 브라우저(쿠키 bv_visitor)는 글마다 하루(한국 시간) 1줄.
// IP·회원 ID는 저장하지 않는다. 오늘·어제만 필요해서 정리 작업(npm run posts:cleanup)이 그 전 행을 지운다
export const postViews = pgTable(
  "post_views",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    visitorId: uuid("visitor_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.date, t.visitorId] })],
);
