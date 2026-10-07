-- Blogville ERD (docs/02-erd.md v1.1) → ERDCloud 가져오기용 DDL
-- ERDCloud에서: 새 ERD → 가져오기(Import) → SQL → 이 파일 내용을 붙여 넣기 (DB 종류: MySQL)
-- 실제 DB는 PostgreSQL이다. ERDCloud가 읽을 수 있게 MySQL 문법으로 옮겼다.
--   TIMESTAMPTZ → DATETIME, UUID → CHAR(36), ENUM 타입 → ENUM('...'), IDENTITY → AUTO_INCREMENT
--   부분 고유 인덱스(user_animals 무료 알)와 CHECK는 MySQL/ERDCloud가 못 그려서 테이블 COMMENT에 적었다.
-- 순서: 부모 테이블 → 자식 테이블 (FK가 앞의 테이블을 가리키도록)

-- ===== 인증 =====
CREATE TABLE `users` (
  `id` VARCHAR(32) NOT NULL COMMENT '회원 ID (로그인 라이브러리가 만드는 무작위 32자)',
  `name` VARCHAR(100) NOT NULL COMMENT '이름',
  `email` VARCHAR(254) NOT NULL COMMENT '이메일',
  `email_verified` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '이메일 인증 여부',
  `image` VARCHAR(2048) NULL COMMENT '소셜 프로필 사진 주소',
  `username` VARCHAR(20) NOT NULL COMMENT '아이디 (4~20자, 영문 소문자·숫자·_)',
  `display_username` VARCHAR(20) NULL COMMENT '표시용 아이디 (입력한 대소문자 그대로)',
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user' COMMENT '권한',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '가입 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_uq` (`email`),
  UNIQUE KEY `users_username_uq` (`username`)
) COMMENT = '회원';

CREATE TABLE `accounts` (
  `id` VARCHAR(32) NOT NULL COMMENT '로그인 수단 ID',
  `user_id` VARCHAR(32) NOT NULL COMMENT '회원 ID',
  `provider_id` VARCHAR(20) NOT NULL COMMENT '서비스 (credential / kakao / naver / google)',
  `account_id` VARCHAR(255) NOT NULL COMMENT '서비스 쪽 사용자 번호 (아이디 로그인이면 회원 ID)',
  `access_token` TEXT NULL COMMENT '소셜 액세스 토큰',
  `refresh_token` TEXT NULL COMMENT '소셜 리프레시 토큰',
  `id_token` TEXT NULL COMMENT '소셜 ID 토큰',
  `access_token_expires_at` DATETIME NULL COMMENT '액세스 토큰 만료',
  `refresh_token_expires_at` DATETIME NULL COMMENT '리프레시 토큰 만료',
  `scope` VARCHAR(500) NULL COMMENT '소셜 권한 목록',
  `password` VARCHAR(255) NULL COMMENT '비밀번호 해시 (아이디 로그인만)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '연동 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_provider_account_uq` (`provider_id`, `account_id`),
  UNIQUE KEY `accounts_user_provider_uq` (`user_id`, `provider_id`),
  CONSTRAINT `accounts_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) COMMENT = '로그인 수단 (아이디 1 + 연동한 소셜). 소셜은 가입이 아니라 연동';

CREATE TABLE `sessions` (
  `id` VARCHAR(32) NOT NULL COMMENT '세션 ID',
  `user_id` VARCHAR(32) NOT NULL COMMENT '회원 ID',
  `token` CHAR(32) NOT NULL COMMENT '세션 토큰 (쿠키에 담기는 값)',
  `expires_at` DATETIME NOT NULL COMMENT '만료 일시 (로그인 7일 뒤)',
  `ip_address` VARCHAR(45) NULL COMMENT '접속 IP',
  `user_agent` VARCHAR(512) NULL COMMENT '브라우저 정보',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '로그인 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '연장 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sessions_token_uq` (`token`),
  CONSTRAINT `sessions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) COMMENT = '로그인 세션 (토큰으로 누구인지·유효한지 확인)';

CREATE TABLE `verifications` (
  `id` VARCHAR(32) NOT NULL COMMENT 'ID',
  `identifier` VARCHAR(255) NOT NULL COMMENT '무엇을 인증하는지',
  `value` VARCHAR(255) NOT NULL COMMENT '인증 값',
  `expires_at` DATETIME NOT NULL COMMENT '만료 일시',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`)
) COMMENT = '인증 임시 값 (로그인 라이브러리 내부용, 관계 없음)';

-- ===== 아이템 =====
CREATE TABLE `items` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '아이템 ID',
  `code` VARCHAR(30) NOT NULL COMMENT '아이템 코드 (예: bg_beach)',
  `type` ENUM('character', 'background', 'furniture') NOT NULL COMMENT '종류',
  `name` VARCHAR(30) NOT NULL COMMENT '이름',
  `description` VARCHAR(200) NULL COMMENT '설명',
  `price` INT NOT NULL DEFAULT 0 COMMENT '가격 (코인, 0 이상)',
  `required_level` SMALLINT NOT NULL DEFAULT 1 COMMENT '필요 레벨 (1~99)',
  `is_starter` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '가입 때 받는 기본 아이템',
  `asset_key` VARCHAR(50) NOT NULL COMMENT '그림 이름 (예: bg.beach)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `items_code_uq` (`code`)
) COMMENT = '아이템 카탈로그. CHECK price >= 0, required_level >= 1';

CREATE TABLE `user_items` (
  `user_id` VARCHAR(32) NOT NULL COMMENT '회원 ID',
  `item_id` INT NOT NULL COMMENT '아이템 ID',
  `acquired_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '얻은 일시',
  PRIMARY KEY (`user_id`, `item_id`),
  CONSTRAINT `user_items_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_items_item_fk` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`)
) COMMENT = '보유 아이템 (회원 ↔ 아이템 N:M). 복합 PK = 같은 아이템 두 번 보유 불가';

-- ===== 회원·블로그 =====
CREATE TABLE `blogs` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '블로그 ID',
  `owner_id` VARCHAR(32) NOT NULL COMMENT '주인 회원 ID',
  `slug` VARCHAR(20) NOT NULL COMMENT '블로그 주소 /@주소 (가입 때 아이디로 자동)',
  `title` VARCHAR(40) NOT NULL COMMENT '블로그 이름 (가입 때 아이디의 블로그)',
  `description` VARCHAR(160) NOT NULL DEFAULT '' COMMENT '소개',
  `background_item_id` INT NOT NULL COMMENT '배경 아이템 ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `blogs_owner_uq` (`owner_id`),
  UNIQUE KEY `blogs_slug_uq` (`slug`),
  CONSTRAINT `blogs_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `blogs_background_owned_fk` FOREIGN KEY (`owner_id`, `background_item_id`) REFERENCES `user_items` (`user_id`, `item_id`)
) COMMENT = '블로그 (회원당 1개 필수, 가입 때 자동 생성). 배경은 보유한 아이템만 (복합 FK). CHECK slug ^[a-z0-9_]{3,20}$, 이름 1~40자';

CREATE TABLE `categories` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '카테고리 ID',
  `blog_id` INT NOT NULL COMMENT '블로그 ID',
  `name` VARCHAR(20) NOT NULL COMMENT '이름 (1~20자)',
  `position` SMALLINT NOT NULL DEFAULT 0 COMMENT '화면 순서',
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_blog_name_uq` (`blog_id`, `name`),
  CONSTRAINT `categories_blog_fk` FOREIGN KEY (`blog_id`) REFERENCES `blogs` (`id`) ON DELETE CASCADE
) COMMENT = '카테고리. 한 블로그 안에서 이름 중복 불가';

-- ===== 글·교류 =====
CREATE TABLE `posts` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '글 ID',
  `blog_id` INT NOT NULL COMMENT '블로그 ID (작성자는 블로그 주인)',
  `category_id` INT NULL COMMENT '카테고리 ID (없으면 NULL)',
  `title` VARCHAR(100) NOT NULL COMMENT '제목 (1~100자)',
  `content_html` TEXT NOT NULL COMMENT '본문 HTML (정화됨)',
  `content_text` TEXT NOT NULL COMMENT '본문 글자 (요약·검색·글자 수용, 일부러 남긴 중복)',
  `visibility` ENUM('public', 'private') NOT NULL DEFAULT 'public' COMMENT '공개 설정',
  `view_count` INT NOT NULL DEFAULT 0 COMMENT '조회수 (0 이상)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  KEY `posts_blog_created_idx` (`blog_id`, `created_at`),
  KEY `posts_visibility_created_idx` (`visibility`, `created_at`),
  CONSTRAINT `posts_blog_fk` FOREIGN KEY (`blog_id`) REFERENCES `blogs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `posts_category_fk` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) COMMENT = '글';

-- ===== 첨부 (글 다음, 프로필 앞: 둘 다 첨부와 이어진다) =====
CREATE TABLE `attachments` (
  `key` CHAR(32) NOT NULL COMMENT '첨부 키 (무작위 16진수 32자 = 주소 /files/키)',
  `user_id` VARCHAR(32) NOT NULL COMMENT '올린 회원 ID',
  `post_id` INT NULL COMMENT '붙은 글 ID (쓰는 중이면 NULL)',
  `kind` ENUM('image', 'file') NOT NULL COMMENT '사진 / 파일',
  `name` VARCHAR(255) NOT NULL COMMENT '원래 파일 이름',
  `mime` VARCHAR(100) NOT NULL COMMENT '형식 (예: image/png)',
  `size` INT NOT NULL COMMENT '크기 (바이트, 0보다 큼)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '올린 일시',
  PRIMARY KEY (`key`),
  KEY `attachments_post_idx` (`post_id`),
  CONSTRAINT `attachments_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attachments_post_fk` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE SET NULL
) COMMENT = '첨부 (글쓰기·프로필 사진에서만)';

-- ===== 프로필 =====
CREATE TABLE `profiles` (
  `user_id` VARCHAR(32) NOT NULL COMMENT '회원 ID',
  `nickname` VARCHAR(20) NOT NULL COMMENT '닉네임 (2~20자, 가입 때 아이디로 자동)',
  `character_item_id` INT NOT NULL COMMENT '장착 캐릭터 아이템 ID',
  `photo_key` CHAR(32) NULL COMMENT '프로필 사진 첨부 키',
  `invited_by` VARCHAR(32) NULL COMMENT '초대한 회원 ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `profiles_nickname_uq` (`nickname`),
  CONSTRAINT `profiles_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `profiles_character_owned_fk` FOREIGN KEY (`user_id`, `character_item_id`) REFERENCES `user_items` (`user_id`, `item_id`),
  CONSTRAINT `profiles_photo_fk` FOREIGN KEY (`photo_key`) REFERENCES `attachments` (`key`) ON DELETE SET NULL,
  CONSTRAINT `profiles_invited_by_fk` FOREIGN KEY (`invited_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) COMMENT = '프로필 (회원 1:1, 가입 때 자동 생성). 장착 캐릭터는 보유한 아이템만 (복합 FK). CHECK 닉네임 2~20자';

CREATE TABLE `tags` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '태그 ID',
  `name` VARCHAR(20) NOT NULL COMMENT '태그 이름',
  PRIMARY KEY (`id`),
  UNIQUE KEY `tags_name_uq` (`name`)
) COMMENT = '태그 (마을 전체가 같이 씀)';

CREATE TABLE `post_tags` (
  `post_id` INT NOT NULL COMMENT '글 ID',
  `tag_id` INT NOT NULL COMMENT '태그 ID',
  PRIMARY KEY (`post_id`, `tag_id`),
  KEY `post_tags_tag_idx` (`tag_id`),
  CONSTRAINT `post_tags_post_fk` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_tags_tag_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) COMMENT = '글 ↔ 태그 (N:M)';

CREATE TABLE `comments` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '댓글 ID',
  `post_id` INT NOT NULL COMMENT '글 ID',
  `author_id` VARCHAR(32) NOT NULL COMMENT '작성자 회원 ID',
  `content` VARCHAR(1000) NOT NULL COMMENT '내용 (1~1000자)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 일시',
  `deleted_at` DATETIME NULL COMMENT '삭제 일시 (지워도 답글이 남도록 행은 둔다)',
  PRIMARY KEY (`id`),
  KEY `comments_post_created_idx` (`post_id`, `created_at`),
  CONSTRAINT `comments_post_fk` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_author_fk` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) COMMENT = '댓글 (글에 단 것만)';

CREATE TABLE `replies` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '답글 ID',
  `comment_id` INT NOT NULL COMMENT '댓글 ID',
  `author_id` VARCHAR(32) NOT NULL COMMENT '작성자 회원 ID',
  `content` VARCHAR(1000) NOT NULL COMMENT '내용 (1~1000자)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 일시',
  `deleted_at` DATETIME NULL COMMENT '삭제 일시',
  PRIMARY KEY (`id`),
  KEY `replies_comment_created_idx` (`comment_id`, `created_at`),
  CONSTRAINT `replies_comment_fk` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `replies_author_fk` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) COMMENT = '답글 (댓글에 1단계만, 답글의 답글은 구조상 불가)';

CREATE TABLE `post_likes` (
  `post_id` INT NOT NULL COMMENT '글 ID',
  `user_id` VARCHAR(32) NOT NULL COMMENT '회원 ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '공감 일시',
  PRIMARY KEY (`post_id`, `user_id`),
  CONSTRAINT `post_likes_post_fk` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_likes_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) COMMENT = '공감 (글 ↔ 회원 N:M). 복합 PK = 한 글에 공감 한 번';

CREATE TABLE `follows` (
  `follower_id` VARCHAR(32) NOT NULL COMMENT '이웃 추가한 회원 ID',
  `followee_id` VARCHAR(32) NOT NULL COMMENT '이웃으로 추가된 회원 ID',
  `is_favorite` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '즐겨찾는 이웃 (최대 10명)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '이웃 추가 일시',
  PRIMARY KEY (`follower_id`, `followee_id`),
  KEY `follows_followee_idx` (`followee_id`),
  CONSTRAINT `follows_follower_fk` FOREIGN KEY (`follower_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `follows_followee_fk` FOREIGN KEY (`followee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) COMMENT = '이웃 (회원 ↔ 회원 N:M). CHECK follower_id <> followee_id';

CREATE TABLE `blog_visits` (
  `blog_id` INT NOT NULL COMMENT '블로그 ID',
  `date` DATE NOT NULL COMMENT '방문 날짜 (한국)',
  `visitor_id` CHAR(36) NOT NULL COMMENT '방문자 쿠키 (UUID)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '기록 일시',
  PRIMARY KEY (`blog_id`, `date`, `visitor_id`),
  CONSTRAINT `blog_visits_blog_fk` FOREIGN KEY (`blog_id`) REFERENCES `blogs` (`id`) ON DELETE CASCADE
) COMMENT = '블로그 방문 기록. 복합 PK = 같은 사람 하루 1번';

-- ===== 보상 =====
CREATE TABLE `attendance_rewards` (
  `day` SMALLINT NOT NULL COMMENT '일차 (1~7)',
  `exp` INT NOT NULL COMMENT '경험치',
  `coins` INT NOT NULL COMMENT '코인',
  PRIMARY KEY (`day`)
) COMMENT = '출석 일차별 보상표 (7행). CHECK day 1~7, exp·coins >= 0';

CREATE TABLE `attendances` (
  `user_id` VARCHAR(32) NOT NULL COMMENT '회원 ID',
  `date` DATE NOT NULL COMMENT '출석 날짜 (한국)',
  `cycle_day` SMALLINT NOT NULL COMMENT '출석 일차 (1~7)',
  `session_id` VARCHAR(32) NULL COMMENT '자동 출석한 세션 ID',
  `checked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '출석 일시',
  PRIMARY KEY (`user_id`, `date`),
  CONSTRAINT `attendances_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendances_reward_fk` FOREIGN KEY (`cycle_day`) REFERENCES `attendance_rewards` (`day`),
  CONSTRAINT `attendances_session_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE SET NULL
) COMMENT = '출석 (로그인 세션으로 자동, 7일 주기). 복합 PK = 하루 한 번';

CREATE TABLE `point_ledger` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '원장 ID',
  `user_id` VARCHAR(32) NOT NULL COMMENT '회원 ID',
  `reason` ENUM('signup', 'attendance', 'attendance_streak', 'post', 'comment', 'like_received', 'purchase', 'farm_care', 'farm_grown', 'egg_purchase', 'invite', 'invited') NOT NULL COMMENT '사유',
  `exp_delta` INT NOT NULL DEFAULT 0 COMMENT '경험치 변화 (0 이상)',
  `coin_delta` INT NOT NULL DEFAULT 0 COMMENT '코인 변화 (쓰면 음수)',
  `ref_id` VARCHAR(32) NULL COMMENT '관련 행 ID (글·아이템·동물·출석 날짜·초대한 친구, FK 아님)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '기록 일시',
  PRIMARY KEY (`id`),
  KEY `point_ledger_user_reason_created_idx` (`user_id`, `reason`, `created_at`),
  KEY `point_ledger_user_created_idx` (`user_id`, `created_at`),
  CONSTRAINT `point_ledger_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) COMMENT = '경험치·코인 원장. 잔액 = SUM(coin_delta), 레벨 = SUM(exp_delta) (잔액 컬럼 없음). CHECK exp_delta >= 0, exp_delta <> 0 OR coin_delta <> 0';

-- ===== 동물 농장 =====
CREATE TABLE `animal_species` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '동물 종류 ID',
  `code` VARCHAR(20) NOT NULL COMMENT '코드 (예: chick)',
  `name` VARCHAR(20) NOT NULL COMMENT '이름',
  `asset_key` VARCHAR(50) NOT NULL COMMENT '그림 이름',
  `grow_exp` INT NOT NULL COMMENT '다 자라는 데 필요한 성장치',
  `reward_exp` INT NOT NULL COMMENT '다 키운 보상 경험치',
  `reward_coins` INT NOT NULL COMMENT '다 키운 보상 코인',
  `hatch_weight` SMALLINT NOT NULL COMMENT '부화 확률 비중',
  PRIMARY KEY (`id`),
  UNIQUE KEY `animal_species_code_uq` (`code`)
) COMMENT = '동물 종류 카탈로그. CHECK grow_exp > 0, 보상 >= 0, hatch_weight > 0';

CREATE TABLE `user_animals` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '동물 ID',
  `user_id` VARCHAR(32) NOT NULL COMMENT '회원 ID',
  `species_id` INT NULL COMMENT '동물 종류 ID (알이면 NULL)',
  `status` ENUM('egg', 'growing', 'grown') NOT NULL DEFAULT 'egg' COMMENT '상태',
  `growth` INT NOT NULL DEFAULT 0 COMMENT '성장치',
  `source` ENUM('starter', 'level', 'shop') NOT NULL COMMENT '알 출처',
  `source_level` SMALLINT NULL COMMENT '레벨 보상 알이면 그 레벨',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '받은 일시',
  `hatched_at` DATETIME NULL COMMENT '부화 일시',
  `grown_at` DATETIME NULL COMMENT '다 자란 일시',
  PRIMARY KEY (`id`),
  KEY `user_animals_user_status_idx` (`user_id`, `status`),
  CONSTRAINT `user_animals_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_animals_species_fk` FOREIGN KEY (`species_id`) REFERENCES `animal_species` (`id`)
) COMMENT = '내 알·동물. CHECK (status = egg) = (species_id IS NULL), (source = level) = (source_level IS NOT NULL). 부분 UNIQUE: (user_id) WHERE source = starter, (user_id, source_level) WHERE source = level';

CREATE TABLE `animal_cares` (
  `animal_id` INT NOT NULL COMMENT '동물 ID',
  `action` ENUM('feed', 'water', 'pet') NOT NULL COMMENT '돌보기 (밥 / 물 / 쓰다듬기)',
  `date` DATE NOT NULL COMMENT '날짜 (한국)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '기록 일시',
  PRIMARY KEY (`animal_id`, `action`, `date`),
  CONSTRAINT `animal_cares_animal_fk` FOREIGN KEY (`animal_id`) REFERENCES `user_animals` (`id`) ON DELETE CASCADE
) COMMENT = '돌보기 기록. 복합 PK = 같은 돌보기 하루 한 번';
