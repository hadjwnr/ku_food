"use strict";
const $=id=>document.getElementById(id);
const config=window.FOOD_CONFIG||{};
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.supabaseUrl||'') && !String(config.supabaseAnonKey||'').startsWith('YOUR_');
const client=configured && window.supabase ? window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey) : null;
let restaurants=[], history=[], mode='random', spinning=false, rotation=0, admin=false;
let restaurantMenus = [];

const favoritesKey = 'knu-food-favorites-v1';
const recentKey = 'knu-food-recent-v1';

function readStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

let favorites = readStoredArray(favoritesKey);
let recentPicks = readStoredArray(recentKey);
let favoritesOnly = false;

const historyKey='knu-food-history-v2';
try{history=JSON.parse(localStorage.getItem(historyKey)||'[]');if(!Array.isArray(history))history=[]}catch{history=[]}
const colors=['#93c5fd','#fda4af','#fde68a','#86efac','#c4b5fd','#fdba74','#67e8f9','#f9a8d4'];
function validateMapUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    const allowed = ['map.naver.com', 'm.map.naver.com', 'naver.me', 'maps.naver.com', 'map.kakao.com', 'place.map.kakao.com', 'kko.kakao.com'];
    if (url.protocol !== 'https:' || !allowed.includes(host) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
function restaurantMapUrl(restaurant) {
  return validateMapUrl(restaurant.map_url) ||
    `https://map.naver.com/p/search/${encodeURIComponent('경남대학교 ' + restaurant.name)}`;
}
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const filtered = () => {
  const category = $('category').value;
  const budget = Number($('budget').value);

  return restaurants.filter(restaurant => {
    if (
      category !== 'all' &&
      restaurant.category !== category
    ) {
      return false;
    }

    const menus = restaurantMenus.filter(
      menu => menu.restaurant_id === restaurant.id
    );

    if (menus.length > 0) {
      return menus.some(menu => menu.price <= budget);
    }

    // 메뉴가 없는 식당은 기존 예상 가격 사용
    return restaurant.price <= budget;
  });
};
function eligible() {
  let list = filtered();

  if ($('recommendScope').value === 'favorites') {
    list = list.filter(x => favorites.includes(x.id));
  }

  const fresh = list.filter(x => !history.includes(x.id));

  return fresh.length ? fresh : list;
}
function setStatus(message){$('adminStatus').textContent=message}
function updateAdmin(){ $('adminOnly').classList.toggle('hidden',!admin);$('logout').classList.toggle('hidden',!admin);$('login').classList.toggle('hidden',admin);$('email').classList.toggle('hidden',admin);$('password').classList.toggle('hidden',admin);render() }
async function checkAdmin(){if(!client){admin=false;setStatus('Supabase 설정이 필요합니다. README.md를 확인하세요.');updateAdmin();return}try{const {data:{user},error}=await client.auth.getUser();if(error && error.name!=='AuthSessionMissingError')throw error;if(!user){admin=false;setStatus('식당 목록은 누구나 볼 수 있습니다. 관리자만 로그인하여 수정할 수 있습니다.')}else{const {data,error:roleError}=await client.from('restaurant_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(roleError)throw roleError;admin=!!data;setStatus(admin?'관리자 로그인됨 · 식당 및 메뉴 관리 가능':'로그인됨 · 관리자 권한 없음')} }catch(e){admin=false;setStatus('권한 확인 오류: '+e.message)}updateAdmin()}
async function load() {
  if (!client) {
    setStatus('config.js에 Supabase 연결 정보를 입력하세요.');
    render();
    return;
  }

  const { data, error } = await client
    .from('restaurants')
    .select('id,name,category,price,map_url')
    .order('name');

  if (error) {
    setStatus('식당 조회 실패: ' + error.message);
    return;
  }

  restaurants = data || [];

  await loadMenus();
  render();
}
async function loadMenus() {
  if (!client) return;

  const { data, error } = await client
    .from('restaurant_menus')
    .select('id,restaurant_id,name,price')
    .order('price', { ascending: true });

  if (error) {
    console.error('메뉴 조회 실패:', error.message);
    return;
  }

  restaurantMenus = data || [];
}
function getRestaurantPrice(restaurant) {
  const menus = restaurantMenus.filter(
    m => m.restaurant_id === restaurant.id
  );

  if (menus.length === 0) {
    return Number(restaurant.price);
  }

  return Math.min(...menus.map(m => Number(m.price)));
}

function toggleFavorite(id) {
  if (favorites.includes(id)) {
    favorites = favorites.filter(x => x !== id);
  } else {
    favorites = [...favorites, id];
  }

  localStorage.setItem(favoritesKey, JSON.stringify(favorites));
  render();
}

function renderRecent() {
  const el = $('recentList');
  el.replaceChildren();

  const entries = recentPicks
    .map(id => restaurants.find(r => r.id === id))
    .filter(Boolean);

  if (!entries.length) {
    el.textContent = '아직 추천 기록이 없습니다.';
    return;
  }

  entries.forEach(x => {
    const row = document.createElement('div');
    row.className = 'recent-entry';

    const name = document.createElement('strong');
    name.textContent = x.name;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = '다시 보기';
    button.onclick = () => show(x, false);

    row.append(name, button);
    el.append(row);
  });
}

function render() {
  const el = $('items');
  el.replaceChildren();

const search = $('restaurantSearch').value.trim().toLowerCase();
const sort = $('restaurantSort').value;

const visibleRestaurants = restaurants
  .filter(x =>
    x.name.toLowerCase().includes(search) &&
    (!favoritesOnly || favorites.includes(x.id))
  )
  .sort((a, b) => {
    if (sort === 'priceAsc') {
      return getRestaurantPrice(a) - getRestaurantPrice(b);
    }

    if (sort === 'priceDesc') {
      return getRestaurantPrice(b) - getRestaurantPrice(a);
    }

    return a.name.localeCompare(b.name, 'ko');
  });

visibleRestaurants.forEach(x => {

    const row = document.createElement('div');
    row.className = 'item';

    const menus = restaurantMenus.filter(
      m => m.restaurant_id === x.id
    );

    const menuHtml = menus.length
      ? menus.map(m => `
          <div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:14px;">
            <span>${safe(m.name)}</span>
            <strong>${Number(m.price).toLocaleString('ko-KR')}원</strong>
          </div>
        `).join('')
      : '<small>등록된 메뉴가 없습니다.</small>';

    row.innerHTML = `
      <div class="restaurant-card-main">
        <div class="restaurant-card-heading">
          <strong class="restaurant-card-name">${safe(x.name)}</strong>
          <span class="restaurant-card-category">${safe(x.category)}</span>
        </div>
        <div class="restaurant-card-price">
          ${menus.length ? '메뉴 최저' : '예상 가격'}
          <strong>${getRestaurantPrice(x).toLocaleString('ko-KR')}원</strong>
        </div>
        <div class="restaurant-card-actions">
          <details class="restaurant-menu-details">
            <summary>🍽️ 메뉴 보기 <span class="restaurant-menu-count">${menus.length}개</span></summary>
            <div class="restaurant-menu-list">${menuHtml}</div>
          </details>
          <a class="restaurant-map-link" href="${safe(restaurantMapUrl(x))}"
             target="_blank" rel="noopener noreferrer"
             aria-label="${safe(x.name)} 지도에서 보기">🗺️ 지도 보기</a>
        </div>
      </div>
    `;


const favoriteBtn = document.createElement('button');
favoriteBtn.type = 'button';
favoriteBtn.className = 'favorite-btn';

const isFavorite = favorites.includes(x.id);

favoriteBtn.textContent = isFavorite ? '♥' : '♡';
favoriteBtn.setAttribute('aria-pressed', String(isFavorite));
favoriteBtn.setAttribute(
  'aria-label',
  `${x.name} 즐겨찾기 ${isFavorite ? '해제' : '추가'}`
);

favoriteBtn.onclick = () => toggleFavorite(x.id);

row.append(favoriteBtn);

if (admin) {
  const manage = document.createElement('details');
  manage.className = 'restaurant-manage';
  
manage.addEventListener('toggle', () => {
  if (!manage.open) return;

  document.querySelectorAll('.restaurant-manage').forEach(other => {
    if (other !== manage) other.open = false;
  });
});

  const summary = document.createElement('summary');
  summary.textContent = '⚙️ 관리';
  summary.setAttribute('aria-label', `${x.name} 관리 메뉴 열기`);

  const menu = document.createElement('div');
  menu.className = 'restaurant-manage-menu';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.textContent = '✏️ 식당 정보 수정';
  editBtn.onclick = () => {
    manage.open = false;
    openRestaurantEditor(x);
  };

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.textContent = '🍽️ 메뉴 관리';
  menuBtn.onclick = () => {
    manage.open = false;
    openMenuEditor(x);
  };

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = '🗑️ 식당 삭제';
  deleteBtn.className = 'danger-action';

  deleteBtn.onclick = async () => {
    manage.open = false;

    if (!confirm(
      `${x.name} 식당과 등록된 메뉴를 모두 삭제할까요?`
    )) return;

    deleteBtn.disabled = true;

    const { error } = await client
      .from('restaurants')
      .delete()
      .eq('id', x.id);

    if (error) {
      alert('삭제 실패: ' + error.message);
      deleteBtn.disabled = false;
    } else {
      await load();
    }
  };

  menu.append(editBtn, menuBtn, deleteBtn);
  manage.append(summary, menu);
  row.append(manage);
}

    el.append(row);
  });

$('count').textContent = `(${visibleRestaurants.length}/${restaurants.length}곳)`;

$('favoriteCount').textContent =
  `즐겨찾기 ${favorites.filter(id => restaurants.some(r => r.id === id)).length}곳`;

$('favoritesOnly').textContent =
  favoritesOnly ? '♥ 즐겨찾기만 보는 중' : '♡ 즐겨찾기만 보기';

$('favoritesOnly').setAttribute(
  'aria-pressed',
  String(favoritesOnly)
);

renderRecent();
drawWheel();

}
function drawWheel(){if(spinning)return;const list=eligible().slice(0,12),wheel=$('wheel');wheel.style.transform='rotate(0deg)';rotation=0;if(!list.length){wheel.style.background='#e2e8f0';wheel.replaceChildren();return}wheel.style.background=`conic-gradient(${list.map((x,i)=>`${colors[i%colors.length]} ${i*360/list.length}deg ${(i+1)*360/list.length}deg`).join(',')})`;wheel.replaceChildren();list.forEach((x,i)=>{const t=document.createElement('span');t.className='wheel-label';t.style.transform=`rotate(${(i+.5)*360/list.length-90}deg) translate(36px,-50%)`;t.textContent=x.name;wheel.append(t)})}
function show(x, saveHistory = true) {
  const result = $('result');
  result.classList.remove('hidden');

  const budget = Number($('budget').value);
  const allMenus = restaurantMenus.filter(
    menu => menu.restaurant_id === x.id
  );
  const affordableMenus = allMenus.filter(
    menu => Number(menu.price) <= budget
  );

  const isFavorite = favorites.includes(x.id);
  const price = getRestaurantPrice(x).toLocaleString('ko-KR');

  const menuHtml = allMenus.length
    ? `
      <div class="result-menus">
        <div class="result-section-title">🍽️ 예산에 맞는 메뉴</div>
        ${
          affordableMenus.length
            ? affordableMenus.map(menu => `
              <div class="result-menu-row">
                <span>${safe(menu.name)}</span>
                <span>${Number(menu.price).toLocaleString('ko-KR')}원</span>
              </div>
            `).join('')
            : '<p class="note">예산에 맞는 메뉴가 없습니다.</p>'
        }
      </div>
    `
    : '<p class="note">등록된 메뉴가 없어 예상 가격을 표시합니다.</p>';

  result.innerHTML = `
    <div class="result-top">
      <span class="result-label">🎉 오늘의 추천</span>
      <button
        type="button"
        id="resultFavorite"
        class="result-favorite"
        aria-pressed="${isFavorite}"
        aria-label="${safe(x.name)} 즐겨찾기 ${isFavorite ? '해제' : '추가'}"
      >${isFavorite ? '♥' : '♡'}</button>
    </div>

    <div class="result-name">${safe(x.name)}</div>

    <div class="result-meta">
      <span class="result-category">${safe(x.category)}</span>
      <span>${allMenus.length ? '메뉴 최저' : '예상'} ${price}원</span>
    </div>

    ${menuHtml}

    <a
      href="${safe(restaurantMapUrl(x))}"
      target="_blank"
      rel="noopener noreferrer"
    >🗺️ ${x.map_url && validateMapUrl(x.map_url) ? '지도에서 위치 보기' : '네이버 지도에서 검색'}</a>
  `;

  $('resultFavorite').onclick = () => {
    toggleFavorite(x.id);
    show(x, false);
  };

  if (!saveHistory) return;

  recentPicks = [
    x.id,
    ...recentPicks.filter(id => id !== x.id)
  ].slice(0, 10);

  localStorage.setItem(
    recentKey,
    JSON.stringify(recentPicks)
  );

  renderRecent();

  history = [
    ...history.filter(id => id !== x.id),
    x.id
  ].slice(-Math.max(1, restaurants.length));

  localStorage.setItem(
    historyKey,
    JSON.stringify(history)
  );
}
function pick(){if(spinning)return;const list=eligible();if(!list.length){$('result').classList.remove('hidden');$('result').textContent=  $('recommendScope').value === 'favorites'
    ? '조건에 맞는 즐겨찾기 식당이 없습니다. 식당을 즐겨찾기에 추가하거나 음식 종류·예산을 변경해 주세요.'
    : '조건에 맞는 식당이 없습니다. 음식 종류·예산을 변경해 주세요.' ;return}if(mode==='random'){show(list[Math.floor(Math.random()*list.length)]);drawWheel();return}const wheelList=list.slice(0,12),idx=Math.floor(Math.random()*wheelList.length),n=wheelList.length;const desired=(360-(idx+.5)*360/n)%360;rotation=1800+((desired+360)%360);spinning=true;$('pick').disabled=true;$('wheel').style.transform=`rotate(${rotation}deg)`;$('wheelInfo').textContent='두근두근...';setTimeout(()=>{show(wheelList[idx]);$('wheelInfo').textContent=`🎉 ${wheelList[idx].name}!`;$('pick').disabled=false;spinning=false;drawWheel()},4100)}
function setMode(next){if(spinning)return;mode=next;$('randomTab').classList.toggle('active',mode==='random');$('wheelTab').classList.toggle('active',mode==='wheel');$('randomPanel').classList.toggle('hidden',mode!=='random');$('wheelPanel').classList.toggle('hidden',mode!=='wheel');$('pick').textContent=mode==='random'?'🎲 랜덤 추천하기':'🎡 룰렛 돌리기';$('result').classList.add('hidden');drawWheel()}
$('randomTab').onclick=()=>setMode('random');$('wheelTab').onclick=()=>setMode('wheel');$('pick').onclick=pick;$('category').onchange=drawWheel;$('budget').onchange=drawWheel;
$('resetHistory').onclick=()=>{history=[];localStorage.setItem(historyKey,'[]');drawWheel();$('result').classList.add('hidden')};
$('login').onclick=async()=>{if(!client)return alert('Supabase 연결 설정을 먼저 완료하세요.');const email=$('email').value.trim(),password=$('password').value;if(!email||!password)return alert('이메일과 비밀번호를 입력하세요.');$('login').disabled=true;const {error}=await client.auth.signInWithPassword({email,password});$('password').value='';$('login').disabled=false;if(error)return alert('로그인 실패: '+error.message);await checkAdmin()};
/* 관리자 비밀번호 입력 후 Enter로 로그인 */
$('password').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    $('login').click();
  }
});
$('logout').onclick=async()=>{if(!client)return;const {error}=await client.auth.signOut();if(error)return alert(error.message);await checkAdmin()};
$('addForm').onsubmit = async e => {
  e.preventDefault();
  if (!client || !admin) return;
  const name = $('name').value.trim();
  const price = Number($('price').value);
  const mapUrl = validateMapUrl($('newMapUrl').value);
  if (!name || name.length > 60 || !Number.isInteger(price) || price <= 0 || price > 1000000) {
    return alert('이름과 가격을 확인하세요.');
  }
  if (mapUrl === null) return alert('네이버 지도 또는 카카오맵의 HTTPS 주소를 입력하세요.');
  const btn = $('addForm').querySelector('[type=submit]');
  btn.disabled = true;
  const { error } = await client.from('restaurants').insert({
    name, category: $('newCategory').value, price, map_url: mapUrl || null
  });
  btn.disabled = false;
  if (error) return alert('추가 실패: ' + error.message);
  $('addForm').reset();
  await load();
};

function openEditor(title, html) {
  if (!admin || !client) return;

  $('editorTitle').textContent = title;
  $('editorContent').innerHTML = html;
  $('editorOverlay').classList.remove('hidden');
}

function closeEditor() {
  $('editorOverlay').classList.add('hidden');
  $('editorContent').replaceChildren();
}

$('editorClose').onclick = closeEditor;

$('editorOverlay').onclick = e => {
  if (e.target === $('editorOverlay')) closeEditor();
};

function validPrice(value, allowZero = false) {
  const n = Number(value);
  return value.trim() !== '' &&
    Number.isInteger(n) &&
    n >= (allowZero ? 0 : 1) &&
    n <= 1000000;
}

function openRestaurantEditor(restaurant) {
  openEditor('식당 정보 수정', `
    <form id="editRestaurantForm">
      <div class="editor-field">
        <label for="editRestaurantName">식당 이름</label>
        <input id="editRestaurantName" maxlength="60" required
               value="${safe(restaurant.name)}">
      </div>

      <div class="editor-field">
        <label for="editRestaurantCategory">음식 종류</label>
        <select id="editRestaurantCategory">
          ${['한식','중식','일식','양식','분식','기타'].map(c =>
            `<option value="${c}" ${c === restaurant.category ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </div>

      <div class="editor-field">
        <label for="editRestaurantPrice">예상 가격 (원)</label>
        <input id="editRestaurantPrice" type="number"
               min="1" max="1000000" required
               value="${restaurant.price}">
      </div>

       <div class="editor-field">
         <label for="editRestaurantMapUrl">지도 주소 (선택)</label>
         <input id="editRestaurantMapUrl" type="url" maxlength="2000"
                placeholder="https://map.naver.com/..."
                value="${safe(restaurant.map_url || '')}">
         <p class="note">네이버 지도 또는 카카오맵의 장소 공유 링크를 입력하세요.</p>
       </div>

      <div class="editor-actions">
        <button class="primary" type="submit">변경사항 저장</button>
      </div>
    </form>
  `);

  $('editRestaurantForm').onsubmit = async e => {
    e.preventDefault();

    const name = $('editRestaurantName').value.trim();
    const category = $('editRestaurantCategory').value;
    const priceInput = $('editRestaurantPrice').value;
    const mapUrl = validateMapUrl($('editRestaurantMapUrl').value);

    if (mapUrl === null) {
      alert('네이버 지도 또는 카카오맵의 HTTPS 주소를 입력하세요.');
      return;
    }
    if (!name || name.length > 60 || !validPrice(priceInput)) {
      alert('식당 이름과 가격을 확인해 주세요.');
      return;
    }

    const btn = e.currentTarget.querySelector('[type=submit]');
    btn.disabled = true;

    const { error } = await client
      .from('restaurants')
      .update({ name, category, price: Number(priceInput), map_url: mapUrl || null })
      .eq('id', restaurant.id);

    if (error) {
      alert('수정 실패: ' + error.message);
      btn.disabled = false;
      return;
    }

    closeEditor();
    await load();
  };
}

function openMenuEditor(restaurant) {
  if (!admin || !client) return;

  const menus = restaurantMenus.filter(
    m => m.restaurant_id === restaurant.id
  );

  openEditor(`${restaurant.name} 메뉴 관리`, `
    <div id="editorMenuList">
      ${menus.length ? menus.map(m => `
        <div class="editor-menu">
          <div>
            <strong>${safe(m.name)}</strong>
            <small style="display:block;color:#64748b;">
              ${Number(m.price).toLocaleString('ko-KR')}원
            </small>
          </div>
          <div class="editor-menu-actions">
            <button type="button" class="secondary"
                    data-action="edit" data-id="${m.id}">수정</button>
            <button type="button" class="muted"
                    data-action="delete" data-id="${m.id}">삭제</button>
          </div>
        </div>
      `).join('') : '<p class="note">등록된 메뉴가 없습니다.</p>'}
    </div>

    <h3 style="margin-top:24px;">+ 새 메뉴 추가</h3>

    <form id="addMenuForm">
      <div class="editor-field">
        <label for="menuName">메뉴 이름</label>
        <input id="menuName" maxlength="80" required
               placeholder="예: 김치찌개">
      </div>

      <div class="editor-field">
        <label for="menuPrice">가격 (원)</label>
        <input id="menuPrice" type="number" min="0"
               max="1000000" required placeholder="예: 9000">
      </div>

      <div class="editor-actions">
        <button type="submit" class="primary">메뉴 추가</button>
      </div>
    </form>
  `);

  $('addMenuForm').onsubmit = async e => {
    e.preventDefault();

    const name = $('menuName').value.trim();
    const priceInput = $('menuPrice').value;

    if (!name || name.length > 80 || !validPrice(priceInput, true)) {
      alert('메뉴 이름과 가격을 확인해 주세요.');
      return;
    }

    const btn = e.currentTarget.querySelector('[type=submit]');
    btn.disabled = true;

    const { error } = await client
      .from('restaurant_menus')
      .insert({
        restaurant_id: restaurant.id,
        name,
        price: Number(priceInput)
      });

    if (error) {
      alert('메뉴 추가 실패: ' + error.message);
      btn.disabled = false;
      return;
    }

    await loadMenus();
    render();
    openMenuEditor(restaurant);
  };

  $('editorMenuList').onclick = async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const menu = menus.find(m => m.id === btn.dataset.id);
    if (!menu) return;

    if (btn.dataset.action === 'edit') {
      openMenuItemEditor(restaurant, menu);
      return;
    }

    if (btn.dataset.action === 'delete') {
      if (!confirm(`${menu.name} 메뉴를 삭제할까요?`)) return;

      btn.disabled = true;

      const { error } = await client
        .from('restaurant_menus')
        .delete()
        .eq('id', menu.id)
        .eq('restaurant_id', restaurant.id);

      if (error) {
        alert('삭제 실패: ' + error.message);
        btn.disabled = false;
        return;
      }

      await loadMenus();
      render();
      openMenuEditor(restaurant);
    }
  };
}

function openMenuItemEditor(restaurant, menu) {
  openEditor(`${menu.name} 수정`, `
    <form id="editMenuForm">
      <div class="editor-field">
        <label for="editMenuName">메뉴 이름</label>
        <input id="editMenuName" maxlength="80" required
               value="${safe(menu.name)}">
      </div>

      <div class="editor-field">
        <label for="editMenuPrice">가격 (원)</label>
        <input id="editMenuPrice" type="number" min="0"
               max="1000000" required value="${menu.price}">
      </div>

      <div class="editor-actions">
        <button type="button" id="backToMenus" class="muted">
          메뉴 목록
        </button>
        <button type="submit" class="primary">
          변경사항 저장
        </button>
      </div>
    </form>
  `);

  $('backToMenus').onclick = () => openMenuEditor(restaurant);

  $('editMenuForm').onsubmit = async e => {
    e.preventDefault();

    const name = $('editMenuName').value.trim();
    const priceInput = $('editMenuPrice').value;

    if (!name || name.length > 80 || !validPrice(priceInput, true)) {
      alert('메뉴 이름과 가격을 확인해 주세요.');
      return;
    }

    const btn = e.currentTarget.querySelector('[type=submit]');
    btn.disabled = true;

    const { error } = await client
      .from('restaurant_menus')
      .update({ name, price: Number(priceInput) })
      .eq('id', menu.id)
      .eq('restaurant_id', restaurant.id);

    if (error) {
      alert('수정 실패: ' + error.message);
      btn.disabled = false;
      return;
    }

    await loadMenus();
    render();
    openMenuEditor(restaurant);
  };
}
$('restaurantSearch').addEventListener('input', render);
$('restaurantSort').addEventListener('change', render);

$('favoritesOnly').onclick = () => {
  favoritesOnly = !favoritesOnly;
  render();
};

$('clearRecent').onclick = () => {
  if (!confirm('최근 추천 기록을 모두 삭제할까요?')) return;

  recentPicks = [];
  localStorage.setItem(recentKey, '[]');
  renderRecent();
};

$('recommendScope').addEventListener('change', () => {
  const favoritesMode =
    $('recommendScope').value === 'favorites';

  $('scopeInfo').textContent = favoritesMode
    ? '즐겨찾기한 식당 중 음식 종류와 예산에 맞는 곳에서 추천합니다.'
    : '음식 종류와 예산에 맞는 전체 식당에서 추천합니다.';

  $('result').classList.add('hidden');
  drawWheel();
});

(async()=>{await load();await checkAdmin();if(client){client.auth.onAuthStateChange(()=>{setTimeout(checkAdmin,0)})}})();