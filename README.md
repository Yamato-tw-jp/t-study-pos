# T-Study POS

塾向けの生徒・教師ポータル試作アプリです。

## 機能

- 生徒/教師ログイン
- 生徒マイページ
- 面談予約
- 課題提出と教師評価
- テスト成績入力
- 学習スケジュール
- アカウント設定

## ローカル起動

```bash
npm start
```

起動後、ブラウザで開きます。

```text
http://127.0.0.1:4173
```

## デモログイン

```text
生徒1 ID: kanda001
生徒2 ID: sato002
教師  ID: teacher001
共通パスワード: demo1234
```

## 注意

現在は試作用のメモリ保存です。サーバーを再起動すると、画面から追加したデータは初期状態に戻ります。

Firebase環境変数を設定すると、FirestoreとCloud Storage for Firebaseに保存します。Firebaseのサービスアカウント鍵や `.env` はGitHubに公開しないでください。

## Firebase設定

Renderの `Environment` に以下を設定します。

```text
FIREBASE_PROJECT_ID=FirebaseプロジェクトID
FIREBASE_STORAGE_BUCKET=Firebase Storageのbucket名
FIREBASE_SERVICE_ACCOUNT_BASE64=サービスアカウントJSONをbase64化した文字列
```

ローカルでbase64化する例:

```bash
base64 -i serviceAccountKey.json | tr -d '\n' | pbcopy
```

Firestoreには `tStudyPos/primary` ドキュメントとして生徒・教師データを保存します。課題写真は `assignment-submissions/{studentId}/{assignmentId}/...` に保存し、FirestoreにはStorageパスと表示用URLを保存します。
