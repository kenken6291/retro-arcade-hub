/**
 * RETRO ARCADE HUB - 設定ファイル
 * GASのURLやバージョン情報はここだけを書き換えてください。
 * （GASを再デプロイしてURLが変わった場合も、このファイルのみ修正）
 */
window.APP_CONFIG = Object.freeze({
  // 会員管理システム（Google Apps Script ウェブアプリ）のURL
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyS2YbMuVF8GMuELaYh5YvyszRlcWU5MBxlEMFMX9CsT2-EbX6a6cs-_xiRsheLmj_mSw/exec',

  // バージョン情報（更新のたびに書き換え）
  APP_VERSION: '1.19.0',
  BUILD_DATE: '2026-10-20',
  RELEASE_NOTE: '鉄道の旅（TETSUDO NO TABI）を追加・ハブのログインのまま遊べる自動ログインに対応'
});
