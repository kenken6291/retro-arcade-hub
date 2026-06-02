# Retro Arcade Hub (レトロアーケードハブ)

80年代のゲームセンター（アーケードゲーム）の雰囲気をブラウザ上に再現した、プレミアムでインタラクティブなゲームポータル（ランディングページ）です。GitHubに登録された4つの名作ゲーム（インベーダー、テトリス、ヘッドオン、パックマン）を一覧化し、実際にコインを投入してプレイする体験を楽しめます。

---

## 🕹️ 特長

- **サイバーネオン＆3Dグリッドデザイン**:
  - OutRunスタイルで奥へ流れる3Dグリッドアニメーション背景。
  - 鮮やかに点滅・明滅するネオンライトのグロー効果。
  - Canvasを使用した、カラーバリエーションのあるスクロール星空。
  - Google Fontsのドットフォント「Press Start 2P」をメイン採用。

- **CRTブラウン管モニター・シミュレータ**:
  - CSSとSVGエフェクトを駆使し、ブラウン管特有の横スキャンライン、四隅のビネット（湾曲による影）、および高速なフリッカー（明滅）ノイズを再現。
  - 設定パネルからいつでもON/OFFの切り替えが可能。

- **Web Audio API 8-bitシンセサイザー**:
  - 外部のmp3/wav音源ファイルを一切読み込まず、JavaScriptで直接8-bitのチープな音色をリアルタイム合成。
  - **BGM**: テンポ100bpmのファンキーなメロディラインとベースラインを重ねたチップチューンループ（トグルで再生/停止、音量調整可能）。
  - **SE**: コイン投入音（チャリーン）、カードホバー音（ピコッ）、エラー警告音（ブー）、ゲーム開始ファンファーレなどを搭載。

- **コイン投入＆クレジットシステム**:
  - 「INSERT COIN」ボタンを押してクレジット（CREDIT）を貯めないとゲームがプレイできない、ゲームセンターのギミックを再現。
  - クレジットが0の状態でゲームのプレイボタンを押すと、エラー警告音が鳴り、コインボタンが激しく点滅してお知らせします。
  - ゲームのコード参照（VIEW CODE）はクレジット不要でいつでも閲覧できます。

---

## 📂 ファイル構成

```text
retro-arcade-hub/
├── index.html   # ポータルページの構造・SEO設定・ゲーム紹介・操作方法
├── style.css    # ネオングロー、3Dグリッド、CRTエフェクト、筐体3Dデザイン
├── app.js       # Web Audio APIシンセ、Canvas星空、コインクレジットシステム制御
└── README.md    # 本ドキュメント
```

---

## ⚙️ ゲームのURLカスタマイズ

各ゲームのプレイ用リンクおよびGitHubソースコードリンクは、`app.js` の先頭にある設定を変更することで簡単に書き換えることができます。

`app.js` 内の以下のコードを編集してください：

```javascript
// --- CONFIGURATION ---
const GITHUB_USERNAME = "kenken6291"; // あなたのGitHubユーザー名

const GAMES = {
  invaders: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/neon-invaders/`, // プレイ用URL
    codeUrl: `https://github.com/${GITHUB_USERNAME}/neon-invaders`     // ソースコードURL
  },
  tetris: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/neon-tetris/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/neon-tetris`
  },
  headon: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/head-on-neon/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/head-on-neon`
  },
  pacman: {
    playUrl: `https://${GITHUB_USERNAME}.github.io/pacman-game/`,
    codeUrl: `https://github.com/${GITHUB_USERNAME}/pacman-game`
  }
};
```

※ デフォルトで `kenken6291` 氏のアカウントと、各ゲームのリポジトリ名（`invaders`, `tetris`, `head-on`, `pacman`）で自動的にURLが構成されています。

---

## 🚀 GitHub Pages への公開手順

このランディングページをGitHub上にアップロードし、Web上で一般公開（GitHub Pages）する手順は以下の通りです：

1. **GitHubリポジトリの作成**:
   - GitHub上で新しいリポジトリ（例: `retro-arcade-hub`）をパブリック（Public）で作成します。

2. **ファイルのPush**:
   - ローカルの `retro-arcade-hub` ディレクトリ内でGitリポジトリを初期化し、作成したリモートリポジトリにPushします。
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Retro Arcade Hub Landing Page"
   git branch -M main
   git remote add origin https://github.com/ユーザー名/retro-arcade-hub.git
   git push -u origin main
   ```

3. **GitHub Pagesの設定**:
   - GitHub上のリポジトリページを開き、**Settings**（設定）タブをクリックします。
   - 左サイドバーの **Pages** メニューを選択します。
   - **Build and deployment** > **Source** で「Deploy from a branch」を選択します。
   - **Branch** で `main` (または `master`) ブランチ、および `/ (root)` ディレクトリを選択し、**Save** ボタンを押します。

4. **公開の確認**:
   - 数分待つと、上部に `https://ユーザー名.github.io/retro-arcade-hub/` のような公開URLが表示されます。
   - ブラウザでアクセスし、レトロゲームのサウンドや演出が正しく動作することをご確認ください！
