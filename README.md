# aws-minimal-serverless-template

FastAPI + React の **サーバレス一式テンプレ**です。  
ローカル開発は FastAPI / Vite dev server を Docker Compose で起動しつつ、**DynamoDB と Cognito は AWS 上に “local用” を CDK で構築して利用**します。  
dev / prod は **Lambda + DynamoDB + Cognito + CloudFront + S3** を CDK で一括デプロイします。

---

## 目次

- [アーキテクチャ](#アーキテクチャ)
- [ディレクトリ構成](#ディレクトリ構成)
- [前提条件](#前提条件)
- [環境変数](#環境変数)
- [docker-compose の使い方](#docker-compose-の使い方)
- [ビルド](#ビルド)
- [CDK デプロイ方針](#cdk-デプロイ方針)
- [CDK コマンド（infra/package.json）](#cdk-コマンドinfrapackagejson)
- [Cognito Pool ID / Client ID の扱い](#cognito-pool-id--client-id-の扱い)
- [DynamoDB テーブル定義の追加/変更](#dynamodb-テーブル定義の追加変更)
- [ローカル環境構築手順](#ローカル環境構築手順)
- [dev 環境構築手順](#dev-環境構築手順)
- [prod 環境構築手順](#prod-環境構築手順)
- [削除保護について](#削除保護について)

---

## アーキテクチャ

### Local（開発時）
- Backend: **FastAPI**（コンテナで起動 / `STAGE=local` 固定）
- Frontend: **React + Vite + TypeScript**（dev server）
- DB: **DynamoDB（AWS上に local 用を構築して利用）**
- Auth: **Cognito（AWS上に local 用を構築して利用）**

> ローカルで DynamoDB / Cognito をエミュレートしません（LocalStack 等は使わない想定）。  
> “local” ステージ用の AWS リソースを CDK で作って、FastAPI から boto3 で参照します。

### dev / prod
- Backend: **AWS Lambda**（FastAPI を Mangum でラップした handler をデプロイ）
- Frontend: **S3 + CloudFront**（React build を S3 に配置）
- Routing: **CloudFront が `/api*` を API オリジンへ転送**
  - `/api*` → Lambda（APIオリジン）
  - それ以外 → S3（静的配信）

---

## ディレクトリ構成

- `backend/` … FastAPI
  - `backend/dist/` … Lambda 用ビルド成果物（依存ライブラリ + アプリ本体）
- `frontend/` … React + Vite + TypeScript
  - `frontend/dist/` … 静的サイト成果物
- `infra/` … AWS CDK (TypeScript)
  - `infra/bin/` … エントリ（stage 固定）
    - `local.ts` / `dev.ts` / `prod.ts`
  - `infra/lib/` … 各スタック実装
  - `infra/scripts/` … 補助スクリプト（`.env.local` 同期）
- `build_artifacts.sh` … バックエンド + フロントエンドのビルド統合シェル
- `.env` … PROJECT_NAME / AWS_PROFILE
- `.env.local` … local 用の Cognito 設定（自動生成）

---

## 前提条件

- Docker / Docker Compose
- AWS アカウント
- `~/.aws/config` と `~/.aws/credentials` にプロファイルを設定済み
- CDK bootstrap 済み（`cdk bootstrap`）
- IAM ユーザ/ロールに必要権限を付与済み（後述）

---

## 環境変数

### `.env`
- `PROJECT_NAME`
  - **AWSアカウント + リージョン内で一意**になる名前にしてください  
  - リソース名・スタック名は **`${PROJECT_NAME}-${STAGE}`** で決まります
- `AWS_PROFILE`
  - `~/.aws/config` / `credentials` の profile 名

### `.env.local`（自動生成）
- local 用の **Cognito User Pool ID / Client ID** を保持します
- CDK の `cdk-outputs.json` を元に生成します

生成スクリプト:
- `infra/scripts/sync-env-local.ts`
- `npm run sync:env:local`

---

## docker-compose の使い方

用途別にプロファイルを分けています。

- **local のアプリ起動（FastAPI + Frontend dev server）**
  - `--profile app:local`

- **CDK 実行用コンテナ**
  - `--profile cdk`

例:
```bash
# CDK コンテナ起動
docker-compose --profile cdk up -d

# CDK コンテナに入る
docker-compose exec cdk bash

# local アプリ起動（ホストで実行）
docker-compose --profile app:local up

---

## ビルド

`build_artifacts.sh` が バックエンド + フロントエンドのビルドをまとめています。

### バックエンド（Lambda 互換ビルド）

* 公式 Lambda イメージを使って `pip install` し、互換性を担保します
* 出力:

  * 依存ライブラリ: `backend/dist/`
  * アプリ本体: `backend/dist/app/`（`rsync` でコピー）

### フロントエンド（静的ビルド）

* local 実行と同じ系統の nodejs-slim コンテナで `npm run build` します
* 出力:

  * `frontend/dist/`

実行:

```bash
bash build_artifacts.sh
```

成果物確認:

* `backend/dist` に依存が入っている
* `backend/dist/app` に FastAPI のソースがある
* `frontend/dist` に静的アセットがある

---

## CDK デプロイ方針

### リソース名 / スタック名

クラウドのリソースと CloudFormation のスタック名は **`${PROJECT_NAME}-${STAGE}`** で管理されます。

* `PROJECT_NAME` は `.env` に環境変数として保持
* `STAGE` は `local` / `dev` / `prod` のいずれか
* FastAPI は `STAGE=local` で固定
* CDK は `bin/local.ts` / `bin/dev.ts` / `bin/prod.ts` で stage を固定指定します

### デプロイ対象

* **local**: DynamoDB / Cognito のみデプロイ
* **dev / prod**: 一式（DynamoDB / Cognito / Lambda / S3 / CloudFront）を一括デプロイ

---

## CDK コマンド（infra/package.json）

このリポジトリでは `infra/bin/local.ts | dev.ts | prod.ts` を **stage 固定の CDK エントリ**として分けています。
`infra/package.json` のコマンドはそれを叩き分けるためのラッパーです。

### 1) エントリ選択（cdk:*）

* `npm run cdk:local`
  `bin/local.ts` を `ts-node` で実行して CDK を起動します（`STAGE=local` 固定）。

* `npm run cdk:dev`
  `bin/dev.ts` を実行（`STAGE=dev` 固定）。

* `npm run cdk:prod`
  `bin/prod.ts` を実行（`STAGE=prod` 固定）。

> これらは「`cdk` コマンドに `--app "ts-node ... bin/*.ts"` を渡す」だけの薄いラッパーです。
> CDK のサブコマンド（`deploy`, `diff`, `destroy` など）は `--` 以降に続けて渡せます。

例:

```bash
npm run cdk:dev -- diff
npm run cdk:prod -- synth
```

### 2) local の部分デプロイ（deploy:local:*）

local ステージは **DynamoDB / Cognito のみを AWS 上に構築**します。
用途に応じて “一部だけ” デプロイできるように分けています。

* `npm run deploy:local:cognito`
  Cognito だけをデプロイします。`cdk-outputs.json` を出力します。

* `npm run deploy:local:dynamodb`
  DynamoDB だけをデプロイします。

* `npm run deploy:local:all`
  local 用の全スタックをデプロイします。`cdk-outputs.json` を出力します。

`-c deployTarget=...` について:

* `-c` は CDK の context 値です（`deployTarget`）
* 本テンプレでは **スタック構成の組み立て側（app-assembly 等）**で `deployTarget` を参照し、
  「Cognito だけ / DynamoDB だけ / 全部」を切り替えるために使っています

`--outputs-file cdk-outputs.json` について:

* Cognito の `UserPoolId` / `UserPoolClientId` を `cdk-outputs.json` に出力し、
  `sync:env:local` で `.env.local` を生成するために使います
* そのため **local の Cognito をデプロイしたら `sync:env:local` を実行**してください

### 3) dev / prod の一括デプロイ（deploy:*）

dev / prod はアプリ一式をまとめてデプロイします。

* `npm run deploy:dev`
  dev の全スタックを `--all` でデプロイします。

* `npm run deploy:prod`
  prod の全スタックを `--all` でデプロイします（削除保護が有効なリソースがあります）。

### 4) local 用 `.env.local` 同期（sync:env:local）

* `npm run sync:env:local`
  `cdk-outputs.json` を元に `.env.local` を自動生成します。
  local の FastAPI が Cognito を検証するために必要です。

推奨フロー（local）:

```bash
npm run deploy:local:all
npm run sync:env:local
```

---

## Cognito Pool ID / Client ID の扱い

このテンプレでは、**フロントが Cognito 設定値を環境変数として持ちません**。

### バックエンド側

* **local**: `.env.local` に `pool id` / `client id` を持つ（検証用）
* **dev / prod**: CDK が Lambda の環境変数として自動注入する

### フロントエンド側

* `pool id` / `client id` を環境変数で持たない
* 起動時にバックエンドの公開 API から取得して `Amplify.configure()` に渡す

公開 API:

* `GET /api/public_config`

フロントの流れ（概要）:

1. 画面起動
2. `/api/public_config` を呼ぶ
3. 返ってきた `pool id` / `client id` を使って Amplify を configure
4. Cognito 認証 UI を表示

---

## DynamoDB テーブル定義の追加/変更

テーブル定義はここにあります:

* `infra/lib/dynamodb-stack.ts`

テーブルを追加/変更した場合は **Lambda からのアクセス権限付与**も必要です。
このテンプレでは、`DynamoDbStack → ApiLambdaStack` にテーブル参照を渡して `grantReadWriteData()` します。

### 1) DynamoDbStack に public プロパティを追加

`infra/lib/dynamodb-stack.ts`

```ts
export class DynamoDbStack extends cdk.Stack {
  public readonly todosTable: dynamodb.Table;
}
```

### 2) ApiLambdaStackProps にテーブルを追加

`infra/lib/lambda-stack.ts`

```ts
export interface ApiLambdaStackProps extends StackProps {
  ctx: AppContext;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
  // Lambdaのビルドディレクトリ（"/backend/dist"）
  lambdaDistDir: string;
  // Lambda handler（"app.main.handler"）
  handler: string;
  todoTable: dynamodb.ITable;
}
```

### 3) Lambda への権限付与を追加

`infra/lib/lambda-stack.ts` の権限付与箇所:

```ts
props.todoTable.grantReadWriteData(fn);
```

### 4) app-assembly で ApiLambdaStack にテーブル参照を渡す

`infra/lib/app-assembly.ts`

```ts
const api = new ApiLambdaStack(app, `ApiLambdaStack-${ctx.baseName}`, {
  ctx,
  cognitoUserPoolId: cognito.userPoolId,
  cognitoUserPoolClientId: cognito.userPoolClientId,
  lambdaDistDir: "../backend/dist",
  handler: "app.main.handler",
  todoTable: dynamodb.todosTable,
});
```

---

## ローカル環境構築手順

1. （未実施なら）CDK bootstrap

   * 公式手順通りに `cdk bootstrap` を実行してください（本テンプレでは特別な指定はありません）

2. IAM ユーザを作成し、必要権限を付与

必要ポリシー（標準）:

* `AmazonCognitoPowerUser`
* `AmazonDynamoDBFullAccess`
* `AmazonSSMReadOnlyAccess`
* `AWSCloudFormationFullAccess`

加えて、CDK が使うロールを AssumeRole するためのカスタムポリシー（例）:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::<AWSアカウントID>:role/cdk-hnb659fds-*"
    }
  ]
}
```

3. `~/.aws/config` / `~/.aws/credentials` にプロファイルを追加

4. `.env` に `AWS_PROFILE` と `PROJECT_NAME` を設定

   * `PROJECT_NAME` は **一意**になる名前にしてください

5. CDK コンテナ起動 → コンテナに入る

```bash
docker-compose --profile cdk up -d
docker-compose exec cdk bash
```

6. local 用 DynamoDB / Cognito を作成

```bash
npm run deploy:local:all
```

7. `.env.local` を生成

```bash
npm run sync:env:local
```

8. ホスト側で local アプリ起動

```bash
docker-compose --profile app:local up
```

9. 動作確認

   * `http://localhost:5173` にアクセス

---

## dev 環境構築手順

1. 成果物ビルド

```bash
bash build_artifacts.sh
```

2. CDK コンテナ起動 → コンテナに入る

```bash
docker-compose --profile cdk up -d
docker-compose exec cdk bash
```

3. dev を一括デプロイ

```bash
npm run deploy:dev
```

4. デプロイ中に IAM の `StatementChange` 確認（y/n）が複数回出るので `y` で続行

5. CloudFront の URL が表示されたら完了

   * URL にアクセスして動作確認

---

## prod 環境構築手順

基本は dev と同じで、コマンドだけが違います。

1. 成果物ビルド

```bash
bash build_artifacts.sh
```

2. CDK コンテナ起動 → コンテナに入る

```bash
docker-compose --profile cdk up -d
docker-compose exec cdk bash
```

3. prod を一括デプロイ

```bash
npm run deploy:prod
```

4. CloudFront の URL が表示されたら完了

   * URL にアクセスして動作確認

> prod は **削除保護**が有効なスタック/リソースがあるため注意してください（後述）。

---

## 削除保護について

prod（`STAGE=prod`）では、以下が **削除保護**されます。

* Cognito のスタック、および User Pool
* DynamoDB のスタック、および テーブル
* S3 bucket

> dev / local では削除保護は基本的に想定していません。
> prod は誤削除のリスクが高いので注意してください。


---
## License

MIT License
