---
name: outfit-advice
description: 地名を受け取り、Open-Meteo MCP で天気を取得して日本語40字以内の服装アドバイスを返す手順。"Tokyo の服装は？" や "大阪の天気に合った服装" のように地名が含まれるときに使用する。
---

# 服装アドバイス手順

## ステップ 1: 地名から緯度・経度を取得する

`openmeteo_search_locations` ツールを呼び出す。

```json
{ "name": "<ユーザーが指定した地名>" }
```

レスポンスの `structuredContent.results[0]` から `latitude` と `longitude` を取得する。

- `results` が空または存在しない場合 → 「地名が見つかりませんでした」と日本語で伝えて終了する。

## ステップ 2: 天気予報を取得する

`openmeteo_get_forecast` ツールを呼び出す。

```json
{
  "latitude": <number>,
  "longitude": <number>,
  "timezone": "auto",
  "forecast_days": 1,
  "current_variables": ["temperature_2m", "weather_code"],
  "daily_variables": ["precipitation_probability_max"]
}
```

`structuredContent`（本文テキストではなく）から以下を取得する。

| フィールド | パス |
|-----------|------|
| 気温 (°C) | `structuredContent.current.temperature_2m` |
| WMO 天気コード | `structuredContent.current.weather_code` |
| 降水確率 (%) | `structuredContent.daily[0].precipitation_probability_max` |

- `temperature_2m` または `weather_code` が null / 未定義の場合 → デフォルト値で続行せず、日本語のエラーを返して終了する。

## ステップ 3: WMO コードを条件文字列に変換する

| WMO コード | 条件 |
|------------|------|
| 0 | Clear |
| 1–3 | Clouds |
| 45, 48 | Fog |
| 51–57 | Drizzle |
| 61–67 | Rain |
| 71–77 | Snow |
| 80–82 | Rain（にわか雨） |
| 85–86 | Snow（にわか雪） |
| 95–99 | Thunderstorm |
| その他 | Unknown |

## ステップ 4: 傘が必要かを判定する

次のいずれかを満たすとき「傘が必要」とする。

- 条件が Rain / Drizzle / Thunderstorm（大文字小文字を区別しない）
- 降水確率 ≥ 60%

## ステップ 5: アドバイスを選ぶ

上から順に評価し、最初に一致したものを使う。

| 優先順位 | 条件 | アドバイス |
|---------|------|-----------|
| 1 | 傘が必要 かつ 気温 < 10°C | 「傘を持って、厚手のコートで防寒を。」 |
| 2 | 傘が必要 かつ 気温 < 20°C | 「傘を忘れずに。上着もあると安心です。」 |
| 3 | 傘が必要 | 「傘を持って出かけましょう。」 |
| 4 | Snow かつ 気温 < 10°C | 「防寒対策をしっかりして、足元に気をつけて。」 |
| 5 | Snow | 「雪です。防寒と足元に注意しましょう。」 |
| 6 | 気温 < 10°C | 「厚手のコートが必要です。防寒を万全に。」 |
| 7 | 気温 < 20°C | 「カーディガンか薄手のジャケットが快適です。」 |
| 8 | それ以外 | 「軽装でも大丈夫な陽気です。」 |

## ステップ 6: 出力する

`.kiro/steering/project.md` のルールに従い、以下のとおり出力する。

- **日本語の一言のみ**を返す
- **40字以内**（Unicode コードポイント数で計算）
- **絵文字は使わない**
- 気温・コード・確率の数値は出力に含めない
- 余分な説明・前置き・後書きは一切つけない

出力例（東京、気温 16°C、降水確率 70% の場合）:

```
傘を忘れずに。上着もあると安心です。
```
