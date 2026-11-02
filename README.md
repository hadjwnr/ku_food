# 경남대 오늘 뭐 먹지? (GitHub Pages + Supabase)

## 1. Supabase 준비
1. https://supabase.com 에서 새 프로젝트를 생성합니다.
2. SQL Editor에 `schema.sql` 전체를 붙여 넣고 실행합니다.
3. Authentication > Users에서 **Add user**로 관리자 이메일/비밀번호 사용자를 생성합니다. 관리자 이메일은 실제 수신 가능한 주소를 사용하세요.
4. Users에서 해당 사용자의 **User UID**를 복사합니다. SQL Editor에서 아래 문장을 UUID를 바꿔 실행합니다.
   ```sql
   insert into public.restaurant_admins(user_id) values ('실제-관리자-UUID');
   ```
5. Authentication > Providers에서 Email 로그인을 활성화합니다. 공개 가입을 원하지 않으면 신규 사용자 가입을 비활성화합니다. 관리자 계정은 대시보드에서 만듭니다.
6. Project Settings > API 또는 Connect 화면에서 Project URL과 **publishable key**(또는 레거시 `anon` key)를 확인합니다.
7. `config.js`의 두 값을 교체합니다. **service_role/secret key, DB 비밀번호는 절대 웹파일에 넣지 마세요.** 공개 키는 노출되어도 되지만 RLS를 반드시 유지해야 합니다.

## 2. GitHub Pages 배포
1. GitHub에 새 **public** 저장소를 만듭니다 (예: `kyungnam-food`).
2. `index.html`, `app.js`, `config.js`, `schema.sql`, `README.md` 파일을 저장소 **최상위**에 업로드하고 커밋합니다. (`schema.sql`에는 비밀값을 넣지 마세요.)
3. 저장소 Settings > Pages > Build and deployment에서 **Deploy from a branch**, `main`, `/ (root)`를 선택하고 Save합니다.
4. 배포 주소는 일반적으로 `https://사용자명.github.io/kyungnam-food/` 입니다. Pages 설정에 실제 주소가 표시됩니다.
5. 배포된 주소로 접속해 식당 목록 조회, 관리자 로그인, 추가, 삭제, 새로고침 후 유지 여부를 확인합니다.

## 3. 보안 및 운영
- 식당은 모두 조회할 수 있지만 등록/삭제는 `restaurant_admins` 테이블에 등록된 사용자만 가능합니다. 관리자 여부는 프런트엔드 표시뿐 아니라 **DB RLS**에서 강제됩니다.
- 관리자 추가/제거는 Supabase SQL Editor에서 `restaurant_admins` 행을 관리하세요.
- 최근 추천 기록은 개인 브라우저의 localStorage에 저장됩니다. 식당 목록만 모든 사용자에게 공유됩니다.
- 룰렛에는 현재 필터 조건에 맞는 식당 중 최대 12곳이 표시됩니다. 12곳 이상이라면 일부만 참여하므로 추후 전체 대상 균등 추첨 방식으로 개선할 수 있습니다.
- GitHub Pages는 정적 호스팅이며 Supabase가 데이터 저장과 인증을 처리합니다.
- 사이트에 실제 가게 정보가 없는 초기 상태는 정상입니다. 관리자 로그인 후 등록하세요.
