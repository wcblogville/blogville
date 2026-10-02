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
  unique,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ===== 열거형 =====
export const itemType = pgEnum("item_type", ["character", "background", "furniture"]);
export const visibility = pgEnum("visibility", ["public", "private"]);
export const userRole = pgEnum("user_role", ["user", "admin"]);
export const ledgerReason = pgEnum("ledger_reason", [
  "signup",
  "attendance",
  "attendance_streak",
  "post",
  "comment",
  "like_received",
  "purchase",
]);

// ===== 인증 (Better Auth가 요구하는 구조) =====
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // 사이트 자체 아이디 로그인 (소셜 로그인 회원은 NULL)
  username: text("username").unique(),
  displayUsername: text("display_username"),
  role: userRole("role").notNull().default("user"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

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
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
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
    // 같은 소셜 계정이 두 회원에 연결될 수 없다
    unique("accounts_provider_account_uq").on(t.providerId, t.accountId),
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
    createdAt: createdAt(),
  },
  (t) => [
    check("items_price_check", sql`${t.price} >= 0`),
    check("items_required_level_check", sql`${t.requiredLevel} >= 1`),
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
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);

// ===== 회원 프로필 · 블로그 =====
// profiles 행이 있다 = 온보딩을 마친 회원
export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull().unique(),
    characterItemId: integer("character_item_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("profiles_nickname_check", sql`char_length(${t.nickname}) BETWEEN 2 AND 12`),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("blogs_slug_check", sql`${t.slug} ~ '^[a-z0-9_]{3,20}$'`),
    check("blogs_title_check", sql`char_length(${t.title}) BETWEEN 1 AND 40`),
    foreignKey({
      name: "blogs_background_owned_fk",
      columns: [t.ownerId, t.backgroundItemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }),
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

// ===== 글 · 교류 =====
export const posts = pgTable(
  "posts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
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
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"),
    content: text("content").notNull(),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // 답글이 남도록 행은 지우지 않는다
  },
  (t) => [
    foreignKey({
      name: "comments_parent_fk",
      columns: [t.parentId],
      foreignColumns: [t.id],
    }).onDelete("cascade"),
    check("comments_content_check", sql`char_length(${t.content}) BETWEEN 1 AND 1000`),
    index("comments_post_created_idx").on(t.postId, t.createdAt),
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
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    check("follows_not_self_check", sql`${t.followerId} <> ${t.followeeId}`),
    index("follows_followee_idx").on(t.followeeId),
  ],
);

// ===== 보상 =====
// 기본 키 (user_id, date) → 하루에 한 번만 출석
export const attendances = pgTable(
  "attendances",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    streak: integer("streak").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date] }),
    check("attendances_streak_check", sql`${t.streak} >= 1`),
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
  ],
);
