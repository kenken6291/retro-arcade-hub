// ============================================================
// RETRO ARCADE HUB - 会員管理システム (Google Apps Script)
// コード.gs
// ============================================================

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 設定（このIDをあなたのスプレッドシートIDに変更してください）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // ← スプレッドシートIDに変更
const MEMBER_SHEET_NAME = '会員データ';
const LOG_SHEET_NAME = 'ログ';
const ADMIN_PASSWORD = 'YOUR_ADMIN_PASSWORD_HERE'; // ← 管理者パスワードを設定

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メインエントリーポイント (GET/POST リクエスト処理)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  // CORS対応ヘッダー付きレスポンス
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const params = e.parameter || {};
    const postData = e.postData ? JSON.parse(e.postData.contents || '{}') : {};
    const data = Object.assign({}, params, postData);
    const action = data.action;

    let result;
    switch (action) {
      case 'login':
        result = handleLogin(data);
        break;
      case 'getCredit':
        result = handleGetCredit(data);
        break;
      case 'useCredit':
        result = handleUseCredit(data);
        break;
      case 'adminLogin':
        result = handleAdminLogin(data);
        break;
      case 'adminGetMembers':
        result = handleAdminGetMembers(data);
        break;
      case 'adminAddMember':
        result = handleAdminAddMember(data);
        break;
      case 'adminUpdateMember':
        result = handleAdminUpdateMember(data);
        break;
      case 'adminDeleteMember':
        result = handleAdminDeleteMember(data);
        break;
      case 'adminUpdateCredit':
        result = handleAdminUpdateCredit(data);
        break;
      default:
        result = { success: false, message: '不明なアクションです。' };
    }

    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({
      success: false,
      message: 'サーバーエラーが発生しました: ' + err.message
    }));
  }

  return output;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 会員認証処理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleLogin(data) {
  const memberId = String(data.memberId || '').trim();
  if (!memberId) {
    return { success: false, message: '会員番号を入力してください。' };
  }

  const member = findMember(memberId);
  if (!member) {
    writeLog(memberId, 'ログイン失敗', '会員番号が見つかりません');
    return { success: false, message: '会員番号が見つかりません。' };
  }

  if (member.status !== '有効') {
    writeLog(memberId, 'ログイン失敗', 'アカウント無効: ' + member.status);
    return { success: false, message: 'このアカウントは現在無効です。管理者にお問い合わせください。' };
  }

  // 最終ログイン日時を更新
  updateLastLogin(memberId);
  writeLog(memberId, 'ログイン成功', 'クレジット: ' + member.credit);

  return {
    success: true,
    memberId: member.memberId,
    memberName: member.memberName,
    credit: parseInt(member.credit) || 0,
    rank: member.rank || 'BRONZE',
    message: 'ようこそ、' + member.memberName + 'さん！'
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// クレジット取得
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleGetCredit(data) {
  const memberId = String(data.memberId || '').trim();
  const sessionToken = data.sessionToken;

  if (!memberId) {
    return { success: false, message: '会員番号が必要です。' };
  }

  const member = findMember(memberId);
  if (!member) {
    return { success: false, message: '会員が見つかりません。' };
  }

  return {
    success: true,
    credit: parseInt(member.credit) || 0,
    memberName: member.memberName,
    rank: member.rank || 'BRONZE'
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// クレジット使用（ゲーム開始時）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleUseCredit(data) {
  const memberId = String(data.memberId || '').trim();
  const gameName = data.gameName || '不明';
  const amount = parseInt(data.amount) || 1;

  if (!memberId) {
    return { success: false, message: '会員番号が必要です。' };
  }

  const member = findMember(memberId);
  if (!member) {
    return { success: false, message: '会員が見つかりません。' };
  }

  const currentCredit = parseInt(member.credit) || 0;
  if (currentCredit < amount) {
    return { success: false, message: 'クレジットが不足しています。' };
  }

  const newCredit = currentCredit - amount;
  updateMemberCredit(memberId, newCredit);
  writeLog(memberId, 'クレジット使用', gameName + ' (' + amount + '使用, 残り' + newCredit + ')');

  return {
    success: true,
    credit: newCredit,
    message: 'クレジットを使用しました。残り: ' + newCredit
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 管理者認証
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminLogin(data) {
  const password = data.password;
  if (password === ADMIN_PASSWORD) {
    // 簡易トークン生成（本番ではより堅牢な方式を推奨）
    const token = Utilities.getUuid();
    // PropertiesServiceにトークンを一時保存（1時間有効）
    PropertiesService.getScriptProperties().setProperty('adminToken_' + token, String(Date.now()));
    return { success: true, token: token };
  }
  return { success: false, message: 'パスワードが違います。' };
}

function validateAdminToken(token) {
  if (!token) return false;
  const stored = PropertiesService.getScriptProperties().getProperty('adminToken_' + token);
  if (!stored) return false;
  const elapsed = Date.now() - parseInt(stored);
  if (elapsed > 3600000) { // 1時間でトークン失効
    PropertiesService.getScriptProperties().deleteProperty('adminToken_' + token);
    return false;
  }
  return true;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 管理者：会員一覧取得
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminGetMembers(data) {
  if (!validateAdminToken(data.token)) {
    return { success: false, message: '管理者権限が必要です。' };
  }

  const sheet = getSheet(MEMBER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { success: true, members: [] };

  const headers = rows[0];
  const members = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue; // 空行スキップ
    members.push({
      row: i + 1,
      memberId: row[0],
      memberName: row[1],
      credit: row[2],
      status: row[3],
      rank: row[4],
      email: row[5],
      joinDate: row[6],
      lastLogin: row[7],
      memo: row[8]
    });
  }
  return { success: true, members: members };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 管理者：会員追加
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminAddMember(data) {
  if (!validateAdminToken(data.token)) {
    return { success: false, message: '管理者権限が必要です。' };
  }

  const memberId = String(data.memberId || '').trim();
  if (!memberId) return { success: false, message: '会員番号は必須です。' };

  // 重複チェック
  if (findMember(memberId)) {
    return { success: false, message: 'この会員番号は既に存在します。' };
  }

  const sheet = getSheet(MEMBER_SHEET_NAME);
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  sheet.appendRow([
    memberId,
    data.memberName || '未設定',
    parseInt(data.credit) || 0,
    data.status || '有効',
    data.rank || 'BRONZE',
    data.email || '',
    now,
    '',
    data.memo || ''
  ]);

  writeLog('ADMIN', '会員追加', memberId + ' / ' + data.memberName);
  return { success: true, message: '会員を追加しました: ' + memberId };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 管理者：会員更新
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminUpdateMember(data) {
  if (!validateAdminToken(data.token)) {
    return { success: false, message: '管理者権限が必要です。' };
  }

  const memberId = String(data.memberId || '').trim();
  const sheet = getSheet(MEMBER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === memberId) {
      if (data.memberName !== undefined) sheet.getRange(i + 1, 2).setValue(data.memberName);
      if (data.credit !== undefined) sheet.getRange(i + 1, 3).setValue(parseInt(data.credit));
      if (data.status !== undefined) sheet.getRange(i + 1, 4).setValue(data.status);
      if (data.rank !== undefined) sheet.getRange(i + 1, 5).setValue(data.rank);
      if (data.email !== undefined) sheet.getRange(i + 1, 6).setValue(data.email);
      if (data.memo !== undefined) sheet.getRange(i + 1, 9).setValue(data.memo);

      writeLog('ADMIN', '会員更新', memberId);
      return { success: true, message: '会員情報を更新しました。' };
    }
  }
  return { success: false, message: '会員が見つかりません。' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 管理者：会員削除
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminDeleteMember(data) {
  if (!validateAdminToken(data.token)) {
    return { success: false, message: '管理者権限が必要です。' };
  }

  const memberId = String(data.memberId || '').trim();
  const sheet = getSheet(MEMBER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === memberId) {
      sheet.deleteRow(i + 1);
      writeLog('ADMIN', '会員削除', memberId);
      return { success: true, message: '会員を削除しました: ' + memberId };
    }
  }
  return { success: false, message: '会員が見つかりません。' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 管理者：クレジット更新（加算・減算・設定）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleAdminUpdateCredit(data) {
  if (!validateAdminToken(data.token)) {
    return { success: false, message: '管理者権限が必要です。' };
  }

  const memberId = String(data.memberId || '').trim();
  const mode = data.mode || 'set'; // 'add', 'subtract', 'set'
  const amount = parseInt(data.amount) || 0;

  const member = findMember(memberId);
  if (!member) return { success: false, message: '会員が見つかりません。' };

  const current = parseInt(member.credit) || 0;
  let newCredit;
  if (mode === 'add') newCredit = current + amount;
  else if (mode === 'subtract') newCredit = Math.max(0, current - amount);
  else newCredit = amount;

  updateMemberCredit(memberId, newCredit);
  writeLog('ADMIN', 'クレジット' + mode, memberId + ': ' + current + '→' + newCredit);
  return { success: true, credit: newCredit, message: 'クレジットを更新しました。' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ユーティリティ関数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (sheetName === MEMBER_SHEET_NAME) {
      sheet.appendRow(['会員番号', '会員名', 'クレジット', 'ステータス', 'ランク', 'メール', '登録日', '最終ログイン', 'メモ']);
      sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#00ff88');
    } else if (sheetName === LOG_SHEET_NAME) {
      sheet.appendRow(['日時', '会員番号', 'アクション', '詳細']);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#00ff88');
    }
  }
  return sheet;
}

function findMember(memberId) {
  const sheet = getSheet(MEMBER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(memberId).trim()) {
      return {
        row: i + 1,
        memberId: rows[i][0],
        memberName: rows[i][1],
        credit: rows[i][2],
        status: rows[i][3],
        rank: rows[i][4],
        email: rows[i][5],
        joinDate: rows[i][6],
        lastLogin: rows[i][7],
        memo: rows[i][8]
      };
    }
  }
  return null;
}

function updateMemberCredit(memberId, newCredit) {
  const sheet = getSheet(MEMBER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(memberId).trim()) {
      sheet.getRange(i + 1, 3).setValue(newCredit);
      return;
    }
  }
}

function updateLastLogin(memberId) {
  const sheet = getSheet(MEMBER_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(memberId).trim()) {
      sheet.getRange(i + 1, 8).setValue(now);
      return;
    }
  }
}

function writeLog(memberId, action, detail) {
  try {
    const sheet = getSheet(LOG_SHEET_NAME);
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    sheet.appendRow([now, memberId, action, detail]);
  } catch (e) {
    // ログ書き込みエラーは無視
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 初期セットアップ（初回のみ実行）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function setupInitialData() {
  const sheet = getSheet(MEMBER_SHEET_NAME);
  if (sheet.getLastRow() <= 1) {
    // サンプルデータを追加
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    sheet.appendRow(['M001', 'テスト太郎', 10, '有効', 'GOLD', 'test@example.com', now, '', 'テスト会員']);
    sheet.appendRow(['M002', 'ゲーム花子', 5, '有効', 'SILVER', '', now, '', '']);
    sheet.appendRow(['M003', '無効会員', 0, '無効', 'BRONZE', '', now, '', '停止中']);
  }
  Logger.log('初期データのセットアップが完了しました。');
}
