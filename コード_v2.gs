// ============================================================
// RETRO ARCADE HUB - 会員管理システム v2 (Google Apps Script)
// コード.gs  ― ニックネーム・お試し登録・自動発番 対応版
// ============================================================

// ━━ 設定（あなたの値に書き換えてください） ━━━━━━━━━━━━━━━━
const SPREADSHEET_ID  = '1QStVU3RSuPsHyCDOBbVFcHLOgfAGd2v9qNhua6Uwm_Q'; // ← スプレッドシートID
const MEMBER_SHEET_NAME = '会員データ';
const LOG_SHEET_NAME    = 'ログ';
const ADMIN_PASSWORD    = 'YOUR_ADMIN_PASSWORD_HERE'; // ← 管理者パスワード
const TRIAL_CREDIT      = 50;   // お試し登録時の初期クレジット
const MEMBER_ID_PREFIX  = 'M';  // 会員番号プレフィックス（例: M0001）
const MEMBER_ID_DIGITS  = 4;    // 会員番号の桁数

// ━━ スプレッドシート列定義（0始まり） ━━━━━━━━━━━━━━━━━━━
// A=会員番号 B=会員名 C=ニックネーム D=クレジット E=ステータス
// F=ランク   G=種別   H=メール      I=登録日     J=最終ログイン K=メモ
const COL = {
  memberId:   0,  // A
  memberName: 1,  // B
  nickname:   2,  // C  ★新規追加
  credit:     3,  // D
  status:     4,  // E
  rank:       5,  // F
  memberType: 6,  // G  ★新規追加（'正規'/'お試し'）
  email:      7,  // H
  joinDate:   8,  // I
  lastLogin:  9,  // J
  memo:       10, // K
};
const COL_COUNT = 11;

// ━━ エントリーポイント ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function doGet(e) {
  const params = e.parameter || {};
  if (params.action) return handleRequest(e);
  return HtmlService.createHtmlOutputFromFile('index.html')
    .setTitle('RETRO ARCADE HUB - Member Login')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
      case 'login':              result = handleLogin(data);              break;
      case 'trialRegister':      result = handleTrialRegister(data);      break; // ★新規
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

function handleLogin(data) {
  const memberId = String(data.memberId || '').trim();
  if (!memberId) return { success: false, message: '会員番号を入力してください。' };

  const member = findMember(memberId);
  if (!member) {
    writeLog(memberId, 'ログイン失敗', '会員番号なし');
    return { success: false, message: '会員番号が見つかりません。' };
  }
  if (member.status !== '有効') {
    writeLog(memberId, 'ログイン失敗', 'アカウント無効');
    return { success: false, message: 'このアカウントは現在無効です。' };
  }
  updateLastLogin(memberId);
  writeLog(memberId, 'ログイン成功', 'CR:' + member.credit);
  return {
    success:    true,
    memberId:   member.memberId,
    memberName: member.memberName,
    nickname:   member.nickname || member.memberName,
    credit:     parseInt(member.credit) || 0,
    rank:       member.rank || 'BRONZE',
    memberType: member.memberType || '正規',
    message:    'ようこそ、' + (member.nickname || member.memberName) + 'さん！'
  };
}

// ━━ お試し登録（ニックネームを入力して即プレイ） ━━━━━━━━━━━

function handleTrialRegister(data) {
  const nickname = String(data.nickname || '').trim();
  if (!nickname) return { success: false, message: 'ニックネームを入力してください。' };
  if (nickname.length > 12) return { success: false, message: 'ニックネームは12文字以内にしてください。' };

  // 自動発番
  const newId = generateMemberId();
  const now   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  const sheet = getSheet(MEMBER_SHEET_NAME);
  const row   = new Array(COL_COUNT).fill('');
  row[COL.memberId]   = newId;
  row[COL.memberName] = 'お試し_' + nickname;
  row[COL.nickname]   = nickname;
  row[COL.credit]     = TRIAL_CREDIT;
  row[COL.status]     = '有効';
  row[COL.rank]       = 'BRONZE';
  row[COL.memberType] = 'お試し';
  row[COL.joinDate]   = now;
  row[COL.lastLogin]  = now;
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
  const gameName = data.gameName || '不明';
  const amount   = parseInt(data.amount) || 1;
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
  if (data.password !== ADMIN_PASSWORD) return { success: false, message: 'パスワードが違います。' };
  const token = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('adminToken_' + token, String(Date.now()));
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

  const now   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  const sheet = getSheet(MEMBER_SHEET_NAME);
  const row   = new Array(COL_COUNT).fill('');
  row[COL.memberId]   = memberId;
  row[COL.memberName] = data.memberName || '未設定';
  row[COL.nickname]   = data.nickname   || data.memberName || '未設定';
  row[COL.credit]     = parseInt(data.credit) || 0;
  row[COL.status]     = data.status     || '有効';
  row[COL.rank]       = data.rank       || 'BRONZE';
  row[COL.memberType] = data.memberType || '正規';
  row[COL.email]      = data.email      || '';
  row[COL.joinDate]   = now;
  row[COL.memo]       = data.memo       || '';
  sheet.appendRow(row);

  writeLog('ADMIN', '会員追加', memberId + '/' + data.memberName);
  return { success: true, message: '会員を追加しました: ' + memberId };
}

// ━━ 管理者：会員更新 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminUpdateMember(data) {
  if (!validateAdminToken(data.token)) return { success: false, message: '管理者権限が必要です。' };
  const memberId = String(data.memberId || '').trim();
  const sheet    = getSheet(MEMBER_SHEET_NAME);
  const rows     = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.memberId]) === memberId) {
      if (data.memberName !== undefined) sheet.getRange(i+1, COL.memberName+1).setValue(data.memberName);
      if (data.nickname   !== undefined) sheet.getRange(i+1, COL.nickname+1)  .setValue(data.nickname);
      if (data.credit     !== undefined) sheet.getRange(i+1, COL.credit+1)    .setValue(parseInt(data.credit));
      if (data.status     !== undefined) sheet.getRange(i+1, COL.status+1)    .setValue(data.status);
      if (data.rank       !== undefined) sheet.getRange(i+1, COL.rank+1)      .setValue(data.rank);
      if (data.memberType !== undefined) sheet.getRange(i+1, COL.memberType+1).setValue(data.memberType);
      if (data.email      !== undefined) sheet.getRange(i+1, COL.email+1)     .setValue(data.email);
      if (data.memo       !== undefined) sheet.getRange(i+1, COL.memo+1)      .setValue(data.memo);
      writeLog('ADMIN', '会員更新', memberId);
      return { success: true, message: '会員情報を更新しました。' };
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (sheetName === MEMBER_SHEET_NAME) {
      sheet.appendRow([
        '会員番号','会員名','ニックネーム','クレジット','ステータス',
        'ランク','種別','メール','登録日','最終ログイン','メモ'
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

function findMember(memberId) {
  const rows = getSheet(MEMBER_SHEET_NAME).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.memberId]).trim() === String(memberId).trim()) {
      const r = rows[i];
      return {
        row: i+1, memberId: r[COL.memberId], memberName: r[COL.memberName],
        nickname: r[COL.nickname], credit: r[COL.credit], status: r[COL.status],
        rank: r[COL.rank], memberType: r[COL.memberType], email: r[COL.email],
        joinDate: r[COL.joinDate], lastLogin: r[COL.lastLogin], memo: r[COL.memo]
      };
    }
  }
  return null;
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

// ━━ 初期セットアップ（初回のみ手動実行） ━━━━━━━━━━━━━━━━

function setupInitialData() {
  const sheet = getSheet(MEMBER_SHEET_NAME);
  if (sheet.getLastRow() <= 1) {
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    const rows = [
      ['M0001','テスト太郎','タロウ', 50,'有効','GOLD',    '正規',  'test@example.com', now,'','サンプル'],
      ['M0002','ゲーム花子','ハナコ', 30,'有効','SILVER',  '正規',  '',                 now,'',''],
      ['M0003','お試しユーザ','ゲストA',50,'有効','BRONZE','お試し','',                 now,'','お試し登録'],
    ];
    rows.forEach(r => sheet.appendRow(r));
  }
  Logger.log('セットアップ完了。generateMemberId() = ' + generateMemberId());
}
