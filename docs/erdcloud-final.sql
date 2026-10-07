CREATE TABLE `users` (
	`id`	VARCHAR(32)	NOT NULL	COMMENT '회원 ID (로그인 라이브러리가 만드는 무작위 32자)',
	`name`	VARCHAR(100)	NOT NULL	COMMENT '이름',
	`email`	VARCHAR(254)	NOT NULL	COMMENT '이메일',
	`email_verified`	BOOLEAN	NOT NULL	DEFAULT FALSE	COMMENT '이메일 인증 여부',
	`image`	VARCHAR(2048)	NULL	COMMENT '소셜 프로필 사진 주소',
	`username`	VARCHAR(20)	NOT NULL	COMMENT '아이디 (4~20자, 영문 소문자·숫자·_)',
	`display_username`	VARCHAR(20)	NULL	COMMENT '표시용 아이디 (입력한 대소문자 그대로)',
	`role`	ENUM('user', 'admin')	NOT NULL	DEFAULT 'user'	COMMENT '권한',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '가입 일시',
	`updated_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '수정 일시'
);

CREATE TABLE `post_likes` (
	`post_id`	INT	NOT NULL	COMMENT '글 ID',
	`user_id`	VARCHAR(32)	NOT NULL	COMMENT '회원 ID',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '공감 일시'
);

CREATE TABLE `attendance_rewards` (
	`day`	SMALLINT	NOT NULL	COMMENT '일차 (1~7)',
	`exp`	INT	NOT NULL	COMMENT '경험치',
	`coins`	INT	NOT NULL	COMMENT '코인'
);

CREATE TABLE `follows` (
	`follower_id`	VARCHAR(32)	NOT NULL	COMMENT '이웃 추가한 회원 ID',
	`followee_id`	VARCHAR(32)	NOT NULL	COMMENT '이웃으로 추가된 회원 ID',
	`is_favorite`	BOOLEAN	NOT NULL	DEFAULT FALSE	COMMENT '즐겨찾는 이웃 (최대 10명)',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '이웃 추가 일시'
);

CREATE TABLE `attachments` (
	`key`	CHAR(32)	NOT NULL	COMMENT '첨부 키 (무작위 16진수 32자 = 주소 /files/키)',
	`user_id`	VARCHAR(32)	NOT NULL	COMMENT '올린 회원 ID',
	`post_id`	INT	NULL	COMMENT '붙은 글 ID (쓰는 중이면 NULL)',
	`kind`	ENUM('image', 'file')	NOT NULL	COMMENT '사진 / 파일',
	`name`	VARCHAR(255)	NOT NULL	COMMENT '원래 파일 이름',
	`mime`	VARCHAR(100)	NOT NULL	COMMENT '형식 (예: image/png)',
	`size`	INT	NOT NULL	COMMENT '크기 (바이트, 0보다 큼)',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '올린 일시'
);

CREATE TABLE `accounts` (
	`id`	VARCHAR(32)	NOT NULL	COMMENT '로그인 수단 ID',
	`user_id`	VARCHAR(32)	NOT NULL	COMMENT '회원 ID',
	`provider_id`	VARCHAR(20)	NOT NULL	COMMENT '서비스 (credential / kakao / naver / google)',
	`account_id`	VARCHAR(255)	NOT NULL	COMMENT '서비스 쪽 사용자 번호 (아이디 로그인이면 회원 ID)',
	`access_token`	TEXT	NULL	COMMENT '소셜 액세스 토큰',
	`refresh_token`	TEXT	NULL	COMMENT '소셜 리프레시 토큰',
	`id_token`	TEXT	NULL	COMMENT '소셜 ID 토큰',
	`access_token_expires_at`	DATETIME	NULL	COMMENT '액세스 토큰 만료',
	`refresh_token_expires_at`	DATETIME	NULL	COMMENT '리프레시 토큰 만료',
	`scope`	VARCHAR(500)	NULL	COMMENT '소셜 권한 목록',
	`password`	VARCHAR(255)	NULL	COMMENT '비밀번호 해시 (아이디 로그인만)',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '연동 일시',
	`updated_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '수정 일시'
);

CREATE TABLE `categories` (
	`id`	INT	NOT NULL	COMMENT '카테고리 ID',
	`blog_id`	INT	NOT NULL	COMMENT '블로그 ID',
	`name`	VARCHAR(20)	NOT NULL	COMMENT '이름 (1~20자)',
	`position`	SMALLINT	NOT NULL	DEFAULT 0	COMMENT '화면 순서'
);

CREATE TABLE `user_animals` (
	`id`	INT	NOT NULL	COMMENT '동물 ID',
	`user_id`	VARCHAR(32)	NOT NULL	COMMENT '회원 ID, UK(user_id, id)',
	`species_id`	INT	NULL	COMMENT '동물 종류 ID (알이면 NULL)',
	`status`	ENUM('egg', 'growing', 'grown')	NOT NULL	DEFAULT 'egg'	COMMENT '상태',
	`growth`	INT	NOT NULL	DEFAULT 0	COMMENT '성장치',
	`source`	ENUM('starter', 'level', 'shop')	NOT NULL	COMMENT '알 출처',
	`source_level`	SMALLINT	NULL	COMMENT '레벨 보상 알이면 그 레벨',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '받은 일시',
	`hatched_at`	DATETIME	NULL	COMMENT '부화 일시',
	`grown_at`	DATETIME	NULL	COMMENT '다 자란 일시'
);

CREATE TABLE `blogs` (
	`id`	INT	NOT NULL	COMMENT '블로그 ID',
	`owner_id`	VARCHAR(32)	NOT NULL	COMMENT '주인 회원 ID. FK (owner_id, background_item_id) → user_items: 보유한 배경만. 실제 DB에서는 users.id도 가리킴 (UNIQUE: 회원당 블로그 1개)',
	`slug`	VARCHAR(20)	NOT NULL	COMMENT '블로그 주소 /@주소 (가입 때 아이디로 자동)',
	`title`	VARCHAR(40)	NOT NULL	COMMENT '블로그 이름 (가입 때 아이디의 블로그)',
	`description`	VARCHAR(160)	NOT NULL	DEFAULT ''	COMMENT '소개',
	`background_item_id`	INT	NOT NULL	COMMENT '배경 아이템 ID',
	`showcase_animal_id`	INT	NULL	COMMENT '전시할 동물 ID',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '생성 일시',
	`updated_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '수정 일시'
);

CREATE TABLE `verifications` (
	`id`	VARCHAR(32)	NOT NULL	COMMENT 'ID',
	`identifier`	VARCHAR(255)	NOT NULL	COMMENT '무엇을 인증하는지',
	`value`	TEXT	NOT NULL	COMMENT '인증 값',
	`expires_at`	DATETIME	NOT NULL	COMMENT '만료 일시',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '생성 일시',
	`updated_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '수정 일시'
);

CREATE TABLE `posts` (
	`id`	INT	NOT NULL	COMMENT '글 ID',
	`blog_id`	INT	NOT NULL	COMMENT '블로그 ID (작성자는 블로그 주인)',
	`category_id`	INT	NULL	COMMENT '카테고리 ID (없으면 NULL)',
	`subcategory_id`	INT	NULL	COMMENT '서브카테고리 ID (없으면 NULL)',
	`title`	VARCHAR(100)	NOT NULL	COMMENT '제목 (1~100자)',
	`content_html`	TEXT	NOT NULL	COMMENT '본문 HTML (정화됨)',
	`content_text`	TEXT	NOT NULL	COMMENT '본문 글자 (요약·검색·글자 수용, 일부러 남긴 중복)',
	`visibility`	ENUM('public', 'private')	NOT NULL	DEFAULT 'public'	COMMENT '공개 설정',
	`view_count`	INT	NOT NULL	DEFAULT 0	COMMENT '조회수 (0 이상)',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '작성 일시',
	`updated_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '수정 일시'
);

CREATE TABLE `animal_cares` (
	`action`	ENUM('feed', 'water', 'pet')	NOT NULL	COMMENT '돌보기 (밥 / 물 / 쓰다듬기)',
	`date`	DATE	NOT NULL	COMMENT '날짜 (한국)',
	`animal_id`	INT	NOT NULL	COMMENT '동물 ID',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '기록 일시'
);

CREATE TABLE `post_tags` (
	`post_id`	INT	NOT NULL	COMMENT '글 ID',
	`tag_id`	INT	NOT NULL	COMMENT '태그 ID'
);

CREATE TABLE `attendances` (
	`date`	DATE	NOT NULL	COMMENT '출석 날짜 (한국)',
	`user_id`	VARCHAR(32)	NOT NULL	COMMENT '회원 ID',
	`cycle_day`	SMALLINT	NOT NULL	COMMENT '출석 일차 (1~7)',
	`session_id`	VARCHAR(32)	NULL	COMMENT '자동 출석한 세션 ID',
	`checked_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '출석 일시'
);

CREATE TABLE `animal_species` (
	`id`	INT	NOT NULL	COMMENT '동물 종류 ID',
	`code`	VARCHAR(20)	NOT NULL	COMMENT '코드 (예: chick)',
	`name`	VARCHAR(20)	NOT NULL	COMMENT '이름',
	`asset_key`	VARCHAR(50)	NOT NULL	COMMENT '그림 이름',
	`grow_exp`	INT	NOT NULL	COMMENT '다 자라는 데 필요한 성장치',
	`reward_exp`	INT	NOT NULL	COMMENT '다 키운 보상 경험치',
	`reward_coins`	INT	NOT NULL	COMMENT '다 키운 보상 코인',
	`hatch_weight`	SMALLINT	NOT NULL	COMMENT '부화 확률 비중'
);

CREATE TABLE `point_ledger` (
	`id`	BIGINT	NOT NULL	COMMENT '원장 ID',
	`user_id`	VARCHAR(32)	NOT NULL	COMMENT '회원 ID',
	`reason`	ENUM('signup', 'attendance', 'attendance_streak', 'post', 'comment', 'like_received', 'purchase', 'farm_care', 'farm_grown', 'egg_purchase')	NOT NULL	COMMENT '사유',
	`exp_delta`	INT	NOT NULL	DEFAULT 0	COMMENT '경험치 변화 (0 이상)',
	`coin_delta`	INT	NOT NULL	DEFAULT 0	COMMENT '코인 변화 (쓰면 음수)',
	`ref_id`	VARCHAR(64)	NULL	COMMENT '관련 행 ID (글·아이템·동물·출석 날짜, FK 아님)',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '기록 일시'
);

CREATE TABLE `blog_visits` (
	`date`	DATE	NOT NULL	COMMENT '방문 날짜 (한국)',
	`visitor_id`	CHAR(36)	NOT NULL	COMMENT '방문자 쿠키 (UUID)',
	`blog_id`	INT	NOT NULL	COMMENT '블로그 ID',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '기록 일시'
);

CREATE TABLE `subcategories` (
	`id`	INT	NOT NULL	COMMENT '자동 증가',
	`category_id`	INT	NOT NULL	COMMENT '카테고리 ID',
	`name`	VARCHAR(20)	NOT NULL	COMMENT '이름(1~20자)',
	`position`	SMALLINT	NOT NULL	DEFAULT 0	COMMENT '화면에 보이는 순서 저장하는 숫자'
);

CREATE TABLE `user_items` (
	`user_id`	VARCHAR(32)	NOT NULL	COMMENT '회원 ID',
	`item_id`	INT	NOT NULL	COMMENT '아이템 ID',
	`quantity`	INT	NOT NULL	DEFAULT 1	COMMENT '보유 개수',
	`acquired_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '얻은 일시'
);

CREATE TABLE `items` (
	`id`	INT	NOT NULL	COMMENT '아이템 ID',
	`code`	VARCHAR(30)	NOT NULL	COMMENT '아이템 코드 (예: bg_beach)',
	`type`	ENUM('character', 'background', 'furniture', 'growth')	NOT NULL	COMMENT '종류',
	`name`	VARCHAR(30)	NOT NULL	COMMENT '이름',
	`description`	VARCHAR(200)	NULL	COMMENT '설명',
	`price`	INT	NOT NULL	DEFAULT 0	COMMENT '가격 (코인, 0 이상)',
	`required_level`	SMALLINT	NOT NULL	DEFAULT 1	COMMENT '필요 레벨 (1~99)',
	`is_starter`	BOOLEAN	NOT NULL	DEFAULT FALSE	COMMENT '가입 때 받는 기본 아이템',
	`asset_key`	VARCHAR(50)	NOT NULL	COMMENT '그림 이름 (예: bg.beach)',
	`growth_value`	INT	NULL	COMMENT '쓰면 오르는 성장치',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '등록 일시'
);

CREATE TABLE `sessions` (
	`id`	VARCHAR(32)	NOT NULL	COMMENT '세션 ID',
	`user_id`	VARCHAR(32)	NOT NULL	COMMENT '회원 ID',
	`token`	CHAR(32)	NOT NULL	COMMENT '세션 토큰 (쿠키에 담기는 값)',
	`expires_at`	DATETIME	NOT NULL	COMMENT '만료 일시( 마지막 사용 2시간 뒤, 로그인 상태 유지면 7일)',
	`ip_address`	VARCHAR(45)	NULL	COMMENT '접속 IP',
	`user_agent`	VARCHAR(512)	NULL	COMMENT '브라우저 정보',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '로그인 일시',
	`updated_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '연장 일시'
);

CREATE TABLE `comments` (
	`id`	INT	NOT NULL	COMMENT '댓글 ID',
	`post_id`	INT	NOT NULL	COMMENT '글 ID',
	`author_id`	VARCHAR(32)	NOT NULL	COMMENT '작성자 회원 ID',
	`content`	VARCHAR(1000)	NOT NULL	COMMENT '내용 (1~1000자)',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '작성 일시',
	`deleted_at`	DATETIME	NULL	COMMENT '삭제 일시 (지워도 답글이 남도록 행은 둔다)'
);

CREATE TABLE `replies` (
	`id`	INT	NOT NULL	COMMENT '답글 ID',
	`comment_id`	INT	NOT NULL	COMMENT '댓글 ID',
	`author_id`	VARCHAR(32)	NOT NULL	COMMENT '작성자 회원 ID',
	`content`	VARCHAR(1000)	NOT NULL	COMMENT '내용 (1~1000자)',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '작성 일시',
	`deleted_at`	DATETIME	NULL	COMMENT '삭제 일시'
);

CREATE TABLE `tags` (
	`id`	INT	NOT NULL	COMMENT '태그 ID',
	`name`	VARCHAR(20)	NOT NULL	COMMENT '태그 이름'
);

CREATE TABLE `profiles` (
	`user_id`	VARCHAR(32)	NOT NULL	COMMENT '회원 ID (PK, → users.id)',
	`nickname`	VARCHAR(20)	NOT NULL	COMMENT '닉네임 (2~20자, 가입 때 아이디로 자동)',
	`item_owner_id`	VARCHAR(32)	NOT NULL	COMMENT '회원 ID , item_owner_id는 user_id와 같은 값 (실제 DB에서는 한 칸)',
	`photo_key`	CHAR(32)	NULL	COMMENT '프로필 사진 첨부 키 (없으면 NULL)',
	`character_item_id`	INT	NOT NULL	COMMENT '아이템 ID',
	`created_at`	DATETIME	NOT NULL	DEFAULT CURRENT_TIMESTAMP	COMMENT '생성 일시'
);

ALTER TABLE `users` ADD CONSTRAINT `PK_USERS` PRIMARY KEY (
	`id`
);

ALTER TABLE `post_likes` ADD CONSTRAINT `PK_POST_LIKES` PRIMARY KEY (
	`post_id`,
	`user_id`
);

ALTER TABLE `attendance_rewards` ADD CONSTRAINT `PK_ATTENDANCE_REWARDS` PRIMARY KEY (
	`day`
);

ALTER TABLE `follows` ADD CONSTRAINT `PK_FOLLOWS` PRIMARY KEY (
	`follower_id`,
	`followee_id`
);

ALTER TABLE `attachments` ADD CONSTRAINT `PK_ATTACHMENTS` PRIMARY KEY (
	`key`
);

ALTER TABLE `accounts` ADD CONSTRAINT `PK_ACCOUNTS` PRIMARY KEY (
	`id`
);

ALTER TABLE `categories` ADD CONSTRAINT `PK_CATEGORIES` PRIMARY KEY (
	`id`
);

ALTER TABLE `user_animals` ADD CONSTRAINT `PK_USER_ANIMALS` PRIMARY KEY (
	`id`
);

ALTER TABLE `blogs` ADD CONSTRAINT `PK_BLOGS` PRIMARY KEY (
	`id`
);

ALTER TABLE `verifications` ADD CONSTRAINT `PK_VERIFICATIONS` PRIMARY KEY (
	`id`
);

ALTER TABLE `posts` ADD CONSTRAINT `PK_POSTS` PRIMARY KEY (
	`id`
);

ALTER TABLE `animal_cares` ADD CONSTRAINT `PK_ANIMAL_CARES` PRIMARY KEY (
	`action`,
	`date`,
	`animal_id`
);

ALTER TABLE `post_tags` ADD CONSTRAINT `PK_POST_TAGS` PRIMARY KEY (
	`post_id`,
	`tag_id`
);

ALTER TABLE `attendances` ADD CONSTRAINT `PK_ATTENDANCES` PRIMARY KEY (
	`date`,
	`user_id`
);

ALTER TABLE `animal_species` ADD CONSTRAINT `PK_ANIMAL_SPECIES` PRIMARY KEY (
	`id`
);

ALTER TABLE `point_ledger` ADD CONSTRAINT `PK_POINT_LEDGER` PRIMARY KEY (
	`id`
);

ALTER TABLE `blog_visits` ADD CONSTRAINT `PK_BLOG_VISITS` PRIMARY KEY (
	`date`,
	`visitor_id`,
	`blog_id`
);

ALTER TABLE `subcategories` ADD CONSTRAINT `PK_SUBCATEGORIES` PRIMARY KEY (
	`id`
);

ALTER TABLE `user_items` ADD CONSTRAINT `PK_USER_ITEMS` PRIMARY KEY (
	`user_id`,
	`item_id`
);

ALTER TABLE `items` ADD CONSTRAINT `PK_ITEMS` PRIMARY KEY (
	`id`
);

ALTER TABLE `sessions` ADD CONSTRAINT `PK_SESSIONS` PRIMARY KEY (
	`id`
);

ALTER TABLE `comments` ADD CONSTRAINT `PK_COMMENTS` PRIMARY KEY (
	`id`
);

ALTER TABLE `replies` ADD CONSTRAINT `PK_REPLIES` PRIMARY KEY (
	`id`
);

ALTER TABLE `tags` ADD CONSTRAINT `PK_TAGS` PRIMARY KEY (
	`id`
);

ALTER TABLE `profiles` ADD CONSTRAINT `PK_PROFILES` PRIMARY KEY (
	`user_id`
);

ALTER TABLE `post_likes` ADD CONSTRAINT `FK_posts_TO_post_likes_1` FOREIGN KEY (
	`post_id`
)
REFERENCES `posts` (
	`id`
);

ALTER TABLE `follows` ADD CONSTRAINT `FK_users_TO_follows_1` FOREIGN KEY (
	`follower_id`
)
REFERENCES `users` (
	`id`
);

ALTER TABLE `animal_cares` ADD CONSTRAINT `FK_user_animals_TO_animal_cares_1` FOREIGN KEY (
	`animal_id`
)
REFERENCES `user_animals` (
	`id`
);

ALTER TABLE `post_tags` ADD CONSTRAINT `FK_posts_TO_post_tags_1` FOREIGN KEY (
	`post_id`
)
REFERENCES `posts` (
	`id`
);

ALTER TABLE `attendances` ADD CONSTRAINT `FK_users_TO_attendances_1` FOREIGN KEY (
	`user_id`
)
REFERENCES `users` (
	`id`
);

ALTER TABLE `blog_visits` ADD CONSTRAINT `FK_blogs_TO_blog_visits_1` FOREIGN KEY (
	`blog_id`
)
REFERENCES `blogs` (
	`id`
);

ALTER TABLE `user_items` ADD CONSTRAINT `FK_users_TO_user_items_1` FOREIGN KEY (
	`user_id`
)
REFERENCES `users` (
	`id`
);

ALTER TABLE `user_items` ADD CONSTRAINT `FK_items_TO_user_items_1` FOREIGN KEY (
	`item_id`
)
REFERENCES `items` (
	`id`
);

ALTER TABLE `profiles` ADD CONSTRAINT `FK_users_TO_profiles_1` FOREIGN KEY (
	`user_id`
)
REFERENCES `users` (
	`id`
);

