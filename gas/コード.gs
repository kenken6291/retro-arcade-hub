// ============================================================
// RETRO ARCADE HUB - 会員管理システム v2 (Google Apps Script)
// コード.gs  ― ニックネーム・お試し登録・自動発番 対応版
// ============================================================

// ━━ 設定（機密情報はスクリプトプロパティで管理） ━━━━━━━━━━━━
// SPREADSHEET_ID / ADMIN_PASSWORD / PIN_SALT はソースコードに直書きせず、
// Apps Scriptエディタの「プロジェクトの設定」→「スクリプト プロパティ」で設定してください。
// （このファイルをGitHub等で公開・共有しても秘密情報が漏れません）
//
// 設定するキーと値:
//   SPREADSHEET_ID  : スプレッドシートID
//   ADMIN_PASSWORD  : 管理者パスワード
//   PIN_SALT        : PINハッシュ用ソルト（他人に推測されないランダムな文字列）
const MEMBER_SHEET_NAME = '会員データ';
const LOG_SHEET_NAME    = 'ログ';
const TRIAL_CREDIT      = 50;   // お試し登録時の初期クレジット
const MEMBER_INITIAL_CREDIT = 100; // 正規会員登録時の初期クレジット
const MEMBER_ID_PREFIX  = 'M';  // 会員番号プレフィックス（例: M0001）
const MEMBER_ID_DIGITS  = 4;    // 会員番号の桁数
const MAIL_FROM_NAME    = 'RETRO ARCADE HUB'; // 送信メールの差出人名
const MAIL_FROM_ADDRESS = 'my60smyrules@gmail.com'; // 送信元メールアドレス
// ↑ このアドレスから送信するには、Apps Scriptを承認するGoogleアカウントが
//   my60smyrules@gmail.com 本人であるか、そのアカウントの
//   Gmail設定「アカウントとインポート」→「名前」で
//   my60smyrules@gmail.com を送信エイリアス（メールアドレスを追加）として
//   確認済みにしておく必要があります（他人のアドレスは詐称できません）。

// ━━ ブルートフォース／スパム対策 設定 ━━━━━━━━━━━━━━━━━━━━
const LOGIN_MAX_FAILS      = 5;      // 会員ログイン: この回数失敗したらロック
const LOGIN_LOCK_MINUTES   = 10;     // 会員ログインのロック時間（分）
const ADMIN_MAX_FAILS      = 5;      // 管理者ログイン: この回数失敗したらロック
const ADMIN_LOCK_MINUTES   = 15;     // 管理者ログインのロック時間（分）
const TRIAL_MAX_PER_WINDOW = 5;      // お試し登録: 下記の時間内に許可する最大件数
const TRIAL_WINDOW_MINUTES = 10;     // お試し登録のレート制限ウィンドウ（分）
const REGISTER_MAX_PER_WINDOW  = 5;  // 会員登録: 下記の時間内に許可する最大件数
const REGISTER_WINDOW_MINUTES  = 10; // 会員登録のレート制限ウィンドウ（分）
const FORGOT_MAX_PER_WINDOW    = 3;  // パスワード再発行: 下記の時間内に許可する最大件数（メールアドレス単位）
const FORGOT_WINDOW_MINUTES    = 15; // パスワード再発行のレート制限ウィンドウ（分）
const PASSWORD_MIN_LENGTH      = 8;  // 新パスワードの最小文字数

// ━━ スプレッドシート列定義（0始まり） ━━━━━━━━━━━━━━━━━━━
// A=会員番号 B=会員名 C=ニックネーム D=クレジット E=ステータス
// F=ランク   G=種別   H=メール      I=登録日     J=最終ログイン K=メモ
// L=PINハッシュ（お試し会員用） M=パスワードハッシュ（正規会員用） N=要パスワード変更フラグ
const COL = {
  memberId:   0,  // A
  memberName: 1,  // B
  nickname:   2,  // C
  credit:     3,  // D
  status:     4,  // E
  rank:       5,  // F
  memberType: 6,  // G （'正規'/'お試し'）
  email:      7,  // H
  joinDate:   8,  // I
  lastLogin:  9,  // J
  memo:       10, // K
  pinHash:    11, // L  お試し会員の再ログイン用PINハッシュ
  passwordHash: 12, // M  正規会員のパスワードハッシュ
  mustChangePassword: 13, // N  'TRUE'なら次回ログイン時に強制パスワード変更
};
const COL_COUNT = 14;

// ━━ スクリプトプロパティ取得ヘルパー ━━━━━━━━━━━━━━━━━━━━━

function getSpreadsheetId_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('スクリプトプロパティ「SPREADSHEET_ID」が未設定です。プロジェクトの設定から登録してください。');
  return id;
}

function getAdminPassword_() {
  const pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!pw) throw new Error('スクリプトプロパティ「ADMIN_PASSWORD」が未設定です。プロジェクトの設定から登録してください。');
  return pw;
}

function getPinSalt_() {
  const salt = PropertiesService.getScriptProperties().getProperty('PIN_SALT');
  if (!salt) throw new Error('スクリプトプロパティ「PIN_SALT」が未設定です。プロジェクトの設定から登録してください。');
  return salt;
}

// ━━ エントリーポイント ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function doGet(e) {
  const params = e.parameter || {};
  if (params.action) return handleRequest(e);
  return HtmlService.createHtmlOutputFromFile('index.html')
    .setTitle('RETRO ARCADE HUB - Member Login')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    const params   = e.parameter || {};
    const postData = e.postData ? JSON.parse(e.postData.contents || '{}') : {};
    const data     = Object.assign({}, params, postData);
    let result;
    switch (data.action) {
      case 'register':            result = handleRegister(data);            break; // ★正規会員登録（メール+仮パスワード）
      case 'login':                result = handleLogin(data);               break; // ★正規会員ログイン（メール+パスワード）
      case 'trialLogin':          result = handleTrialLogin(data);          break; // ★お試し会員の再ログイン（会員番号+PIN）
      case 'trialRegister':      result = handleTrialRegister(data);      break;
      case 'changePassword':    result = handleChangePassword(data);     break; // ★初回強制変更・任意変更 共通
      case 'forgotPassword':    result = handleForgotPassword(data);     break; // ★仮パスワード再発行
      case 'getCredit':          result = handleGetCredit(data);          break;
      case 'useCredit':          result = handleUseCredit(data);          break;
      case 'adminLogin':         result = handleAdminLogin(data);         break;
      case 'adminGetMembers':    result = handleAdminGetMembers(data);    break;
      case 'adminAddMember':     result = handleAdminAddMember(data);     break;
      case 'adminUpdateMember':  result = handleAdminUpdateMember(data);  break;
      case 'adminDeleteMember':  result = handleAdminDeleteMember(data);  break;
      case 'adminUpdateCredit':  result = handleAdminUpdateCredit(data);  break;
      default: result = { success: false, message: '不明なアクションです。' };
    }
    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ success: false, message: 'サーバーエラー: ' + err.message }));
  }
  return output;
}

// ━━ ログイン ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━ 正規会員登録（メールアドレス + 仮パスワード発行） ━━━━━━━━

function handleRegister(data) {
  const nickname = String(data.nickname || '').trim();
  const email    = String(data.email || '').trim().toLowerCase();
  if (!nickname) return { success: false, message: 'ニックネームを入力してください。' };
  if (nickname.length > 12) return { success: false, message: 'ニックネームは12文字以内にしてください。' };
  if (!isValidEmail_(email)) return { success: false, message: 'メールアドレスの形式が正しくありません。' };

  // スパム対策：一定時間内の登録件数を制限
  const rl = checkRateLimit_('register', REGISTER_MAX_PER_WINDOW, REGISTER_WINDOW_MINUTES);
  if (!rl.allowed) {
    return { success: false, message: 'ただいま登録が混み合っています。しばらくしてから再度お試しください。' };
  }

  if (findMemberByEmail_(email)) {
    return { success: false, message: 'このメールアドレスは既に登録されています。ログインまたはパスワード再発行をご利用ください。' };
  }

  const newId = generateMemberId();
  const now   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  const tempPassword = generateTempPassword_();

  const sheet = getSheet(MEMBER_SHEET_NAME);
  const row   = new Array(COL_COUNT).fill('');
  row[COL.memberId]     = newId;
  row[COL.memberName]   = sanitizeForSheet_(nickname);
  row[COL.nickname]     = sanitizeForSheet_(nickname);
  row[COL.credit]       = MEMBER_INITIAL_CREDIT;
  row[COL.status]       = '有効';
  row[COL.rank]         = 'BRONZE';
  row[COL.memberType]   = '正規';
  row[COL.email]        = email;
  row[COL.joinDate]     = now;
  row[COL.lastLogin]    = '';
  row[COL.passwordHash] = hashPassword_(tempPassword, email);
  row[COL.mustChangePassword] = 'TRUE';
  sheet.appendRow(row);

  const mailOk = sendMail_(
    email,
    '【RETRO ARCADE HUB】会員登録完了・仮パスワードのお知らせ',
    'RETRO ARCADE HUBへのご登録ありがとうございます。\n\n' +
    '会員番号: ' + newId + '\n' +
    '仮パスワード: ' + tempPassword + '\n\n' +
    'ログイン後、必ず新しいパスワードへの変更をお願いします。\n' +
    'このメールに心当たりがない場合は破棄してください。'
  );

  writeLog(newId, '会員登録', 'メール:' + email + (mailOk ? '' : '（メール送信失敗）'));
  return {
    success: true,
    message: mailOk
      ? '登録が完了しました。ご登録のメールアドレス宛に仮パスワードをお送りしましたのでご確認ください。'
      : '登録は完了しましたが、メール送信に失敗しました。お手数ですが管理者にお問い合わせください。'
  };
}

// ━━ 正規会員ログイン（メールアドレス + パスワード） ━━━━━━━━━

function handleLogin(data) {
  const email    = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '').trim();
  if (!email)    return { success: false, message: 'メールアドレスを入力してください。' };
  if (!password) return { success: false, message: 'パスワードを入力してください。' };

  const lockKey = 'login_' + email;
  const lock = checkLock_(lockKey, LOGIN_MAX_FAILS, LOGIN_LOCK_MINUTES);
  if (lock.locked) {
    writeLog(email, 'ログイン失敗', 'ロック中（あと' + lock.remainingMinutes + '分）');
    return { success: false, message: '試行回数が多すぎます。' + lock.remainingMinutes + '分後に再度お試しください。' };
  }

  const member = findMemberByEmail_(email);
  if (!member || member.memberType !== '正規' || !verifyPassword_(password, member.passwordHash, email)) {
    recordFail_(lockKey, LOGIN_LOCK_MINUTES);
    writeLog(email, 'ログイン失敗', 'メールアドレスまたはパスワードが不正');
    return { success: false, message: 'メールアドレスまたはパスワードが正しくありません。' };
  }
  if (member.status !== '有効') {
    writeLog(member.memberId, 'ログイン失敗', 'アカウント無効');
    return { success: false, message: 'このアカウントは現在無効です。' };
  }
  clearLock_(lockKey);
  updateLastLogin(member.memberId);
  writeLog(member.memberId, 'ログイン成功', 'CR:' + member.credit);
  return {
    success:    true,
    memberId:   member.memberId,
    memberName: member.memberName,
    nickname:   member.nickname || member.memberName,
    credit:     parseInt(member.credit) || 0,
    rank:       member.rank || 'BRONZE',
    memberType: member.memberType || '正規',
    mustChangePassword: isTrueFlag_(member.mustChangePassword),
    message:    'ようこそ、' + (member.nickname || member.memberName) + 'さん！'
  };
}

// ━━ パスワード変更（初回強制変更・任意変更 共通） ━━━━━━━━━━

function handleChangePassword(data) {
  const memberId        = String(data.memberId || '').trim();
  const currentPassword = String(data.currentPassword || '').trim();
  const newPassword     = String(data.newPassword || '').trim();
  if (!memberId)  return { success: false, message: '会員番号が必要です。' };
  if (!currentPassword) return { success: false, message: '現在のパスワードを入力してください。' };
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return { success: false, message: '新しいパスワードは' + PASSWORD_MIN_LENGTH + '文字以上にしてください。' };
  }

  const member = findMember(memberId);
  if (!member || member.memberType !== '正規') return { success: false, message: '会員が見つかりません。' };
  if (!verifyPassword_(currentPassword, member.passwordHash, member.email)) {
    writeLog(memberId, 'パスワード変更失敗', '現在のパスワードが不正');
    return { success: false, message: '現在のパスワードが正しくありません。' };
  }

  updateMemberField(memberId, COL.passwordHash, hashPassword_(newPassword, member.email));
  updateMemberField(memberId, COL.mustChangePassword, 'FALSE');
  writeLog(memberId, 'パスワード変更', '');
  return { success: true, message: 'パスワードを変更しました。' };
}

// ━━ パスワード再発行（仮パスワードを新規発行してメール送信） ━━━

function handleForgotPassword(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const generic = { success: true, message: 'ご入力のメールアドレスが登録されていれば、仮パスワードを送信しました。メールをご確認ください。' };
  if (!isValidEmail_(email)) return generic; // メール存在有無を推測されないよう常に同じ応答にする

  const rl = checkRateLimit_('forgot_' + email, FORGOT_MAX_PER_WINDOW, FORGOT_WINDOW_MINUTES);
  if (!rl.allowed) return generic;

  const member = findMemberByEmail_(email);
  if (!member || member.memberType !== '正規') return generic; // 存在しなくても同じメッセージ

  const tempPassword = generateTempPassword_();
  updateMemberField(member.memberId, COL.passwordHash, hashPassword_(tempPassword, email));
  updateMemberField(member.memberId, COL.mustChangePassword, 'TRUE');

  sendMail_(
    email,
    '【RETRO ARCADE HUB】仮パスワード再発行のお知らせ',
    '仮パスワードを再発行しました。\n\n' +
    '会員番号: ' + member.memberId + '\n' +
    '仮パスワード: ' + tempPassword + '\n\n' +
    'ログイン後、必ず新しいパスワードへの変更をお願いします。\n' +
    '心当たりがない場合はこのメールを破棄し、必要であれば管理者にご連絡ください。'
  );
  writeLog(member.memberId, 'パスワード再発行', 'メール:' + email);
  return generic;
}

// ━━ お試し会員の再ログイン（会員番号 + PIN） ━━━━━━━━━━━━━

function handleTrialLogin(data) {
  const memberId = String(data.memberId || '').trim();
  const pin      = String(data.pin || '').trim();
  if (!memberId) return { success: false, message: '会員番号を入力してください。' };
  if (!pin)      return { success: false, message: '暗証番号（PIN）を入力してください。' };

  const lockKey = 'trialLogin_' + memberId;
  const lock = checkLock_(lockKey, LOGIN_MAX_FAILS, LOGIN_LOCK_MINUTES);
  if (lock.locked) {
    writeLog(memberId, 'お試しログイン失敗', 'ロック中（あと' + lock.remainingMinutes + '分）');
    return { success: false, message: '試行回数が多すぎます。' + lock.remainingMinutes + '分後に再度お試しください。' };
  }

  const member = findMember(memberId);
  if (!member || member.memberType !== 'お試し' || !verifyPin_(pin, member.pinHash, memberId)) {
    recordFail_(lockKey, LOGIN_LOCK_MINUTES);
    writeLog(memberId, 'お試しログイン失敗', '会員番号またはPINが不正');
    return { success: false, message: '会員番号またはPINが正しくありません。' };
  }
  if (member.status !== '有効') {
    writeLog(memberId, 'お試しログイン失敗', 'アカウント無効');
    return { success: false, message: 'このアカウントは現在無効です。' };
  }
  clearLock_(lockKey);
  updateLastLogin(memberId);
  writeLog(memberId, 'お試しログイン成功', 'CR:' + member.credit);
  return {
    success:    true,
    memberId:   member.memberId,
    memberName: member.memberName,
    nickname:   member.nickname || member.memberName,
    credit:     parseInt(member.credit) || 0,
    rank:       member.rank || 'BRONZE',
    memberType: 'お試し',
    message:    'ようこそ、' + (member.nickname || member.memberName) + 'さん！'
  };
}

// ━━ お試し登録（ニックネームを入力して即プレイ） ━━━━━━━━━━━

function handleTrialRegister(data) {
  const nickname = String(data.nickname || '').trim();
  if (!nickname) return { success: false, message: 'ニックネームを入力してください。' };
  if (nickname.length > 12) return { success: false, message: 'ニックネームは12文字以内にしてください。' };

  // スパム対策：一定時間内の登録件数を制限
  const rl = checkRateLimit_('trialRegister', TRIAL_MAX_PER_WINDOW, TRIAL_WINDOW_MINUTES);
  if (!rl.allowed) {
    return { success: false, message: 'ただいま登録が混み合っています。しばらくしてから再度お試しください。' };
  }

  // 自動発番
  const newId = generateMemberId();
  const now   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  const pin   = generatePin_();

  const sheet = getSheet(MEMBER_SHEET_NAME);
  const row   = new Array(COL_COUNT).fill('');
  row[COL.memberId]   = newId;
  row[COL.memberName] = sanitizeForSheet_('お試し_' + nickname);
  row[COL.nickname]   = sanitizeForSheet_(nickname);
  row[COL.credit]     = TRIAL_CREDIT;
  row[COL.status]     = '有効';
  row[COL.rank]       = 'BRONZE';
  row[COL.memberType] = 'お試し';
  row[COL.joinDate]   = now;
  row[COL.lastLogin]  = now;
  row[COL.pinHash]    = hashPin_(pin, newId);
  sheet.appendRow(row);

  writeLog(newId, 'お試し登録', 'ニックネーム:' + nickname + ' CR:' + TRIAL_CREDIT);
  return {
    success:    true,
    memberId:   newId,
    memberName: 'お試し_' + nickname,
    nickname:   nickname,
    credit:     TRIAL_CREDIT,
    rank:       'BRONZE',
    memberType: 'お試し',
    pin:        pin, // ★次回ログイン用。この応答でのみ平文を返す（保存はハッシュのみ）
    message:    'お試し登録完了！会員番号: ' + newId + '　クレジット ' + TRIAL_CREDIT + '枚プレゼント🎮'
  };
}

// ━━ クレジット取得 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleGetCredit(data) {
  const memberId = String(data.memberId || '').trim();
  if (!memberId) return { success: false, message: '会員番号が必要です。' };
  const member = findMember(memberId);
  if (!member) return { success: false, message: '会員が見つかりません。' };
  return {
    success:    true,
    credit:     parseInt(member.credit) || 0,
    memberName: member.memberName,
    nickname:   member.nickname || member.memberName,
    rank:       member.rank || 'BRONZE'
  };
}

// ━━ クレジット使用 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleUseCredit(data) {
  const memberId = String(data.memberId || '').trim();
  const gameName = sanitizeForSheet_(data.gameName || '不明');
  let amount = parseInt(data.amount, 10);
  // amountは1〜10の正の整数のみ許可（負数指定によるクレジット不正加算を防止）
  if (!Number.isInteger(amount) || amount < 1) amount = 1;
  if (amount > 10) amount = 10;
  if (!memberId) return { success: false, message: '会員番号が必要です。' };
  const member = findMember(memberId);
  if (!member) return { success: false, message: '会員が見つかりません。' };
  const current = parseInt(member.credit) || 0;
  if (current < amount) return { success: false, message: 'クレジットが不足しています。' };
  const newCredit = current - amount;
  updateMemberField(memberId, COL.credit, newCredit);
  writeLog(memberId, 'CR使用', gameName + ' -' + amount + ' 残' + newCredit);
  return { success: true, credit: newCredit, message: '残りクレジット: ' + newCredit };
}

// ━━ 管理者認証 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminLogin(data) {
  const lock = checkLock_('admin_login', ADMIN_MAX_FAILS, ADMIN_LOCK_MINUTES);
  if (lock.locked) {
    return { success: false, message: '試行回数が多すぎます。' + lock.remainingMinutes + '分後に再度お試しください。' };
  }
  if (data.password !== getAdminPassword_()) {
    recordFail_('admin_login', ADMIN_LOCK_MINUTES);
    writeLog('ADMIN', '管理者ログイン失敗', '');
    return { success: false, message: 'パスワードが違います。' };
  }
  clearLock_('admin_login');
  const token = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('adminToken_' + token, String(Date.now()));
  writeLog('ADMIN', '管理者ログイン成功', '');
  return { success: true, token: token };
}

function validateAdminToken(token) {
  if (!token) return false;
  const stored = PropertiesService.getScriptProperties().getProperty('adminToken_' + token);
  if (!stored) return false;
  if (Date.now() - parseInt(stored) > 3600000) {
    PropertiesService.getScriptProperties().deleteProperty('adminToken_' + token);
    return false;
  }
  return true;
}

// ━━ 管理者：会員一覧 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminGetMembers(data) {
  if (!validateAdminToken(data.token)) return { success: false, message: '管理者権限が必要です。' };
  const sheet = getSheet(MEMBER_SHEET_NAME);
  const rows  = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { success: true, members: [] };
  const members = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[COL.memberId]) continue;
    members.push({
      row:        i + 1,
      memberId:   r[COL.memberId],
      memberName: r[COL.memberName],
      nickname:   r[COL.nickname],
      credit:     r[COL.credit],
      status:     r[COL.status],
      rank:       r[COL.rank],
      memberType: r[COL.memberType],
      email:      r[COL.email],
      joinDate:   r[COL.joinDate],
      lastLogin:  r[COL.lastLogin],
      memo:       r[COL.memo]
    });
  }
  return { success: true, members: members };
}

// ━━ 管理者：会員追加 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminAddMember(data) {
  if (!validateAdminToken(data.token)) return { success: false, message: '管理者権限が必要です。' };
  const memberId = String(data.memberId || '').trim();
  if (!memberId) return { success: false, message: '会員番号は必須です。' };
  if (findMember(memberId)) return { success: false, message: 'この会員番号は既に存在します。' };

  const memberType = validEnum_(data.memberType, ['正規','お試し'], '正規');
  const email = String(data.email || '').trim().toLowerCase();
  if (memberType === '正規' && email && findMemberByEmail_(email)) {
    return { success: false, message: 'このメールアドレスは既に別の会員で使用されています。' };
  }

  const now   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  const sheet = getSheet(MEMBER_SHEET_NAME);
  const row   = new Array(COL_COUNT).fill('');
  row[COL.memberId]   = memberId;
  row[COL.memberName] = sanitizeForSheet_(data.memberName || '未設定');
  row[COL.nickname]   = sanitizeForSheet_(data.nickname   || data.memberName || '未設定');
  row[COL.credit]     = parseInt(data.credit) || 0;
  row[COL.status]     = validEnum_(data.status, ['有効','無効'], '有効');
  row[COL.rank]       = validEnum_(data.rank, ['BRONZE','SILVER','GOLD','PLATINUM'], 'BRONZE');
  row[COL.memberType] = memberType;
  row[COL.email]      = email;
  row[COL.joinDate]   = now;
  row[COL.memo]       = sanitizeForSheet_(data.memo || '');

  let issuedPin = null, issuedPassword = null, mailOk = null;
  if (memberType === 'お試し') {
    issuedPin = generatePin_();
    row[COL.pinHash] = hashPin_(issuedPin, memberId);
  } else {
    if (!email) return { success: false, message: '正規会員の登録にはメールアドレスが必要です。' };
    issuedPassword = generateTempPassword_();
    row[COL.passwordHash] = hashPassword_(issuedPassword, email);
    row[COL.mustChangePassword] = 'TRUE';
    mailOk = sendMail_(
      email,
      '【RETRO ARCADE HUB】会員登録のお知らせ（管理者による登録）',
      '管理者により会員登録が行われました。\n\n' +
      '会員番号: ' + memberId + '\n' +
      '仮パスワード: ' + issuedPassword + '\n\n' +
      'ログイン後、必ず新しいパスワードへの変更をお願いします。'
    );
  }
  sheet.appendRow(row);

  writeLog('ADMIN', '会員追加', memberId + '/' + data.memberName);
  const note = issuedPin
    ? '（PIN: ' + issuedPin + '　※必ず本人に控えてもらってください）'
    : mailOk ? '（仮パスワードをメール送信しました）' : mailOk === false ? '（メール送信に失敗しました。仮パスワード: ' + issuedPassword + '）' : '';
  return { success: true, pin: issuedPin, message: '会員を追加しました: ' + memberId + note };
}

// ━━ 管理者：会員更新 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminUpdateMember(data) {
  if (!validateAdminToken(data.token)) return { success: false, message: '管理者権限が必要です。' };
  const memberId = String(data.memberId || '').trim();
  const sheet    = getSheet(MEMBER_SHEET_NAME);
  const rows     = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.memberId]) === memberId) {
      const currentEmail = String(rows[i][COL.email] || '').trim().toLowerCase();
      const currentType  = String(rows[i][COL.memberType] || '');
      if (data.memberName !== undefined) sheet.getRange(i+1, COL.memberName+1).setValue(sanitizeForSheet_(data.memberName));
      if (data.nickname   !== undefined) sheet.getRange(i+1, COL.nickname+1)  .setValue(sanitizeForSheet_(data.nickname));
      if (data.credit     !== undefined) sheet.getRange(i+1, COL.credit+1)    .setValue(parseInt(data.credit));
      if (data.status     !== undefined) sheet.getRange(i+1, COL.status+1)    .setValue(validEnum_(data.status, ['有効','無効'], '有効'));
      if (data.rank       !== undefined) sheet.getRange(i+1, COL.rank+1)      .setValue(validEnum_(data.rank, ['BRONZE','SILVER','GOLD','PLATINUM'], 'BRONZE'));
      if (data.memberType !== undefined) sheet.getRange(i+1, COL.memberType+1).setValue(validEnum_(data.memberType, ['正規','お試し'], '正規'));
      let newEmail = currentEmail;
      if (data.email !== undefined) {
        newEmail = String(data.email).trim().toLowerCase();
        sheet.getRange(i+1, COL.email+1).setValue(sanitizeForSheet_(newEmail));
      }
      if (data.memo !== undefined) sheet.getRange(i+1, COL.memo+1).setValue(sanitizeForSheet_(data.memo));

      let newPin = null, newPassword = null, mailOk = null;
      if (data.resetPin) { // お試し会員のPINリセット
        newPin = generatePin_();
        sheet.getRange(i+1, COL.pinHash+1).setValue(hashPin_(newPin, memberId));
      }
      if (data.resetPassword) { // 正規会員の仮パスワード再発行
        if (!newEmail) {
          return { success: false, message: 'パスワード再発行にはメールアドレスの登録が必要です。' };
        }
        newPassword = generateTempPassword_();
        sheet.getRange(i+1, COL.passwordHash+1).setValue(hashPassword_(newPassword, newEmail));
        sheet.getRange(i+1, COL.mustChangePassword+1).setValue('TRUE');
        mailOk = sendMail_(
          newEmail,
          '【RETRO ARCADE HUB】仮パスワード再発行のお知らせ（管理者操作）',
          '管理者操作により仮パスワードを再発行しました。\n\n' +
          '会員番号: ' + memberId + '\n' +
          '仮パスワード: ' + newPassword + '\n\n' +
          'ログイン後、必ず新しいパスワードへの変更をお願いします。'
        );
      }
      clearLock_('login_' + (currentType === '正規' ? currentEmail : memberId));
      clearLock_('trialLogin_' + memberId);
      writeLog('ADMIN', '会員更新', memberId + (newPin ? '（PIN再発行）' : '') + (newPassword ? '（パスワード再発行）' : ''));
      const passNote = newPassword ? (mailOk ? '新しい仮パスワードをメール送信しました。' : '仮パスワード: ' + newPassword + '（メール送信失敗）') : '';
      return {
        success: true,
        pin: newPin,
        message: '会員情報を更新しました。' + (newPin ? '新しいPIN: ' + newPin + '　' : '') + passNote
      };
    }
  }
  return { success: false, message: '会員が見つかりません。' };
}

// ━━ 管理者：会員削除 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminDeleteMember(data) {
  if (!validateAdminToken(data.token)) return { success: false, message: '管理者権限が必要です。' };
  const memberId = String(data.memberId || '').trim();
  const sheet    = getSheet(MEMBER_SHEET_NAME);
  const rows     = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.memberId]) === memberId) {
      sheet.deleteRow(i + 1);
      writeLog('ADMIN', '会員削除', memberId);
      return { success: true, message: '会員を削除しました: ' + memberId };
    }
  }
  return { success: false, message: '会員が見つかりません。' };
}

// ━━ 管理者：クレジット更新 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminUpdateCredit(data) {
  if (!validateAdminToken(data.token)) return { success: false, message: '管理者権限が必要です。' };
  const memberId = String(data.memberId || '').trim();
  const mode     = data.mode || 'set';
  const amount   = parseInt(data.amount) || 0;
  const member   = findMember(memberId);
  if (!member) return { success: false, message: '会員が見つかりません。' };
  const current = parseInt(member.credit) || 0;
  const newCredit =
    mode === 'add'      ? current + amount :
    mode === 'subtract' ? Math.max(0, current - amount) : amount;
  updateMemberField(memberId, COL.credit, newCredit);
  writeLog('ADMIN', 'CR_' + mode, memberId + ':' + current + '→' + newCredit);
  return { success: true, credit: newCredit, message: 'クレジットを更新しました。' };
}

// ━━ ユーティリティ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(getSpreadsheetId_());
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (sheetName === MEMBER_SHEET_NAME) {
      sheet.appendRow([
        '会員番号','会員名','ニックネーム','クレジット','ステータス',
        'ランク','種別','メール','登録日','最終ログイン','メモ',
        'PINハッシュ','パスワードハッシュ','要パスワード変更'
      ]);
      sheet.getRange(1,1,1,COL_COUNT).setFontWeight('bold')
           .setBackground('#1a1a2e').setFontColor('#00ff88');
    } else if (sheetName === LOG_SHEET_NAME) {
      sheet.appendRow(['日時','会員番号','アクション','詳細']);
      sheet.getRange(1,1,1,4).setFontWeight('bold')
           .setBackground('#1a1a2e').setFontColor('#00ff88');
    }
  }
  return sheet;
}

// スプレッドシートは 'TRUE'/'FALSE' という文字列を書き込むと自動的に
// 真偽値(Boolean)型セルに変換することがあり、読み込み時に真偽値true/false
// （小文字）として返ってくる場合と、文字列のまま返る場合がある。
// どちらのパターンでも正しく判定できるようにするヘルパー。
function isTrueFlag_(v) {
  if (v === true) return true;
  return String(v || '').trim().toUpperCase() === 'TRUE';
}

function findMember(memberId) {
  const rows = getSheet(MEMBER_SHEET_NAME).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.memberId]).trim() === String(memberId).trim()) {
      return rowToMember_(rows[i], i + 1);
    }
  }
  return null;
}

function findMemberByEmail_(email) {
  const target = String(email).trim().toLowerCase();
  if (!target) return null;
  const rows = getSheet(MEMBER_SHEET_NAME).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.email] || '').trim().toLowerCase() === target) {
      return rowToMember_(rows[i], i + 1);
    }
  }
  return null;
}

function rowToMember_(r, rowNum) {
  return {
    row: rowNum, memberId: r[COL.memberId], memberName: r[COL.memberName],
    nickname: r[COL.nickname], credit: r[COL.credit], status: r[COL.status],
    rank: r[COL.rank], memberType: r[COL.memberType], email: r[COL.email],
    joinDate: r[COL.joinDate], lastLogin: r[COL.lastLogin], memo: r[COL.memo],
    pinHash: r[COL.pinHash], passwordHash: r[COL.passwordHash],
    mustChangePassword: r[COL.mustChangePassword]
  };
}

function updateMemberField(memberId, colIndex, value) {
  const sheet = getSheet(MEMBER_SHEET_NAME);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.memberId]).trim() === String(memberId).trim()) {
      sheet.getRange(i+1, colIndex+1).setValue(value);
      return;
    }
  }
}

function updateLastLogin(memberId) {
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  updateMemberField(memberId, COL.lastLogin, now);
}

function generateMemberId() {
  const sheet = getSheet(MEMBER_SHEET_NAME);
  const rows  = sheet.getDataRange().getValues();
  let maxNum  = 0;
  for (let i = 1; i < rows.length; i++) {
    const id  = String(rows[i][COL.memberId] || '');
    if (id.startsWith(MEMBER_ID_PREFIX)) {
      const num = parseInt(id.slice(MEMBER_ID_PREFIX.length)) || 0;
      if (num > maxNum) maxNum = num;
    }
  }
  return MEMBER_ID_PREFIX + String(maxNum + 1).padStart(MEMBER_ID_DIGITS, '0');
}

function writeLog(memberId, action, detail) {
  try {
    const sheet = getSheet(LOG_SHEET_NAME);
    const now   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    sheet.appendRow([now, memberId, action, detail]);
  } catch(e) {}
}

// ━━ セキュリティ・ユーティリティ ━━━━━━━━━━━━━━━━━━━━━━━━

// PINをハッシュ化（平文PINはスプレッドシートに保存しない）
function hashPin_(pin, memberId) {
  const raw = getPinSalt_() + ':' + String(memberId).trim() + ':' + String(pin).trim();
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

// 入力されたPINが保存済みハッシュと一致するか検証
function verifyPin_(pin, storedHash, memberId) {
  if (!storedHash) return false; // PIN未設定の会員はログイン不可（管理者にPIN再発行を依頼）
  return hashPin_(pin, memberId) === String(storedHash);
}

// ランダムな4桁PINを生成（お試し会員用）
function generatePin_() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// パスワードをハッシュ化（軽量なソルト付き単発SHA-256。
// PBKDF等の多重ストレッチはGAS実行環境では極端に遅くなり
// タイムアウト・エラーの原因になった実績があるため採用しない）
function hashPassword_(password, email) {
  const raw = getPinSalt_() + ':' + String(email).trim().toLowerCase() + ':' + String(password);
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

// 入力されたパスワードが保存済みハッシュと一致するか検証
function verifyPassword_(password, storedHash, email) {
  if (!storedHash) return false;
  return hashPassword_(password, email) === String(storedHash);
}

// 仮パスワードを生成（10文字の英数字。UUIDの乱数性を利用）
function generateTempPassword_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 10);
}

// メールアドレスの簡易フォーマットチェック
function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

// メール送信（失敗してもアプリ全体を止めないようtry/catchする）
// GmailAppを使用: MailAppは送信ドメインのSPF/DKIM認証が弱く、Gmail等で
// エラーなく静かに破棄されるケースがあるため、実アカウントから送信される
// GmailAppの方が到達率が高い。実行には Gmail送信スコープの承認が必要。
function sendMail_(to, subject, body) {
  try {
    GmailApp.sendEmail(to, subject, body, { name: MAIL_FROM_NAME, from: MAIL_FROM_ADDRESS });
    return true;
  } catch (e) {
    try {
      // 失敗理由をログシートに記録（デバッグ用）
      const sheet = getSheet(LOG_SHEET_NAME);
      const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
      sheet.appendRow([now, to, 'メール送信エラー', String(e && e.message || e)]);
    } catch (e2) {}
    return false;
  }
}

// スプレッドシートに保存する文字列を無害化する
// ・数式インジェクション対策（= + - @ で始まる場合は数式として解釈されないよう先頭にアポストロフィを付与）
// ・過度に長い文字列を切り詰める（シート肥大化・DoS対策）
function sanitizeForSheet_(value) {
  let s = String(value == null ? '' : value).trim();
  if (s.length > 200) s = s.substring(0, 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

// 許可された値（ホワイトリスト）以外を弾き、既定値にフォールバックする
function validEnum_(value, allowed, fallback) {
  const s = String(value == null ? '' : value).trim();
  return allowed.indexOf(s) !== -1 ? s : fallback;
}

// ━━ ブルートフォース／レート制限（PropertiesServiceで簡易実装） ━━

// 失敗回数を記録し、上限に達したらロック開始時刻を保存する
function recordFail_(key, lockMinutes) {
  const props = PropertiesService.getScriptProperties();
  const propKey = 'fail_' + key;
  const stored = JSON.parse(props.getProperty(propKey) || '{"count":0,"first":0}');
  const now = Date.now();
  // 直近のロック時間ウィンドウ外なら失敗カウントをリセット
  if (now - stored.first > lockMinutes * 60000) {
    stored.count = 0;
    stored.first = now;
  }
  stored.count++;
  props.setProperty(propKey, JSON.stringify(stored));
}

// ロック状態を確認する（上限回数を超えていればロック中と判定）
function checkLock_(key, maxFails, lockMinutes) {
  const props = PropertiesService.getScriptProperties();
  const propKey = 'fail_' + key;
  const stored = JSON.parse(props.getProperty(propKey) || '{"count":0,"first":0}');
  const now = Date.now();
  if (stored.count >= maxFails) {
    const elapsedMin = (now - stored.first) / 60000;
    if (elapsedMin < lockMinutes) {
      return { locked: true, remainingMinutes: Math.ceil(lockMinutes - elapsedMin) };
    }
  }
  return { locked: false };
}

// ログイン成功時などに失敗カウントをクリアする
function clearLock_(key) {
  PropertiesService.getScriptProperties().deleteProperty('fail_' + key);
}

// 一定時間内の呼び出し回数を制限する（お試し登録のスパム対策など）
function checkRateLimit_(key, maxCount, windowMinutes) {
  const props = PropertiesService.getScriptProperties();
  const propKey = 'rate_' + key;
  const stored = JSON.parse(props.getProperty(propKey) || '{"count":0,"first":0}');
  const now = Date.now();
  if (now - stored.first > windowMinutes * 60000) {
    stored.count = 0;
    stored.first = now;
  }
  stored.count++;
  props.setProperty(propKey, JSON.stringify(stored));
  return { allowed: stored.count <= maxCount };
}

// ━━ 初期セットアップ（初回のみ手動実行） ━━━━━━━━━━━━━━━━

function setupInitialData() {
  const sheet = getSheet(MEMBER_SHEET_NAME);
  if (sheet.getLastRow() <= 1) {
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    const rows = [
      // 会員番号,会員名,ニックネーム,クレジット,ステータス,ランク,種別,メール,登録日,最終ログイン,メモ,PINハッシュ,パスワードハッシュ,要パスワード変更
      ['M0001','テスト太郎','タロウ', 50,'有効','GOLD',    '正規',  'test@example.com', now,'','サンプル', '', hashPassword_('Sample1234','test@example.com'), 'TRUE'],
      ['M0002','ゲーム花子','ハナコ', 30,'有効','SILVER',  '正規',  '',                 now,'','',        '', '', ''],
      ['M0003','お試しユーザ','ゲストA',50,'有効','BRONZE','お試し','',                 now,'','お試し登録', hashPin_('1234','M0003'), '', ''],
    ];
    rows.forEach(r => sheet.appendRow(r));
  }
  Logger.log('セットアップ完了。generateMemberId() = ' + generateMemberId());
  Logger.log('サンプル正規会員(M0001)の仮パスワードは Sample1234 です（本番投入前に必ず変更・削除してください）。');
  Logger.log('サンプルお試し会員(M0003)のPINは 1234 です。');
}
