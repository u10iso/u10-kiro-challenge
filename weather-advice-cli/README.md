# weather-advice-cli

天気 MCP サーバーから取得した現在の天気と気温をもとに、今日の服装アドバイスを日本語一言（40字以内）で返す CLI ツールです。

## 動作要件

- **Node.js 24 以上**（MCP サーバー `@cyanheads/open-meteo-mcp-server` の要求するバージョン）
- npm 10 以上

## インストール

```bash
cd weather-advice-cli
npm install
npm run build
```

## 使い方

```bash
# デフォルト（東京）
node dist/index.js

# 地名を指定
node dist/index.js --location Osaka
node dist/index.js --location "New York"

# 環境変数で指定
WEATHER_LOCATION=Sapporo node dist/index.js
```

出力例:

```
傘を忘れずに。上着もあると安心です。
```

エラー時は標準エラー出力に日本語メッセージを出してコード 1 で終了します。

```bash
エラー: 天気情報の取得に失敗しました: ...
```

## MCP サーバーの上書き

デフォルトは `npx -y @cyanheads/open-meteo-mcp-server` です。環境変数で変更できます。

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `WEATHER_MCP_CMD` | `npx` | 起動コマンド |
| `WEATHER_MCP_ARGS` | `-y,@cyanheads/open-meteo-mcp-server` | カンマ区切りの引数 |
| `WEATHER_LOCATION` | `Tokyo` | デフォルト地名 |

## 開発

```bash
npm test          # fast-check プロパティテスト（33テスト）
npm run build     # TypeScript → dist/ へコンパイル
```

## アーキテクチャ

```
src/
├── index.ts       CLI エントリ。引数解析 → fetchWeather → advise → stdout
├── advise.ts      純関数。WMO コード変換・服装判断ロジック（I/O なし）
└── mcp-client.ts  MCP 2段階呼び出し（位置検索 → 天気予報）
test/
└── advise.test.ts fast-check プロパティテスト
```

### MCP 呼び出しフロー

```
1. openmeteo_search_locations({ name: location })
   → structuredContent.results[0].{ latitude, longitude }

2. openmeteo_get_forecast({ latitude, longitude, timezone: "auto",
     current_variables: ["temperature_2m", "weather_code"],
     daily_variables: ["precipitation_probability_max"] })
   → structuredContent.current.temperature_2m  （気温 °C）
   → structuredContent.current.weather_code    （WMO コード）
   → structuredContent.daily[0].precipitation_probability_max  （降水確率 %）
```

## Kiro University Challenge — レッスンとファイルの対応表

| レッスン / 要件 | 対応ファイル |
|---------------|-------------|
| EARS 形式の要件定義 | `.kiro/specs/weather-advice/requirements.md` |
| アーキテクチャ設計（2段階 MCP フロー、WMO 変換表） | `.kiro/specs/weather-advice/design.md` |
| タスク分解と受け入れ基準 | `.kiro/specs/weather-advice/tasks.md` |
| ステアリング（出力・アーキテクチャ・エラー・テストのルール） | `.kiro/steering/project.md` |
| 純関数 `advise()` + `wmoToCondition()` | `src/advise.ts` |
| MCP クライアント（副作用あり I/O） | `src/mcp-client.ts` |
| CLI エントリポイント | `src/index.ts` |
| fast-check プロパティテスト（7プロパティ） | `test/advise.test.ts` |
| 保存時自動テストフック | `.kiro/hooks/run-tests-on-save.sh` |
| フック設定（postToolUse） | `.kiro/agents/default.json` |
| ワークスペース MCP サーバー登録 | `.kiro/settings/mcp.json` |
| カスタムエージェント（天気 MCP だけ使用） | `.kiro/agents/weather-advisor.json` |

## WMO 天気コード早見表

| コード | 天気 | 傘が必要？ |
|--------|------|-----------|
| 0 | 快晴 | — |
| 1–3 | 曇り | — |
| 45, 48 | 霧 | — |
| 51–57 | 霧雨 | ✓ |
| 61–67 | 雨 | ✓ |
| 71–77 | 雪 | — |
| 80–82 | にわか雨 | ✓ |
| 85–86 | にわか雪 | — |
| 95–99 | 雷雨 | ✓ |

降水確率が 60% 以上の場合も傘を推奨します。
