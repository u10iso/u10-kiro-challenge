#!/usr/bin/env bash
# run-tests-on-save: npm test を weather-advice-cli で実行し、失敗したら要約を出す
# postToolUse フックから呼ばれる（stdin に JSON が来る）

EVENT=$(cat)

# 保存されたファイルパスを抽出（write ツールの tool_input.path）
SAVED_PATH=$(echo "$EVENT" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    # write ツールは path フィールドを持つ
    print(data.get('tool_input', {}).get('path', ''))
except:
    print('')
" 2>/dev/null)

# 対象パスのフィルタ: weather-advice-cli/src/**/*.ts または weather-advice-cli/test/**/*.ts
if ! echo "$SAVED_PATH" | grep -qE 'weather-advice-cli/(src|test)/.*\.ts$'; then
    exit 0
fi

# プロジェクトルートを特定
PROJECT_DIR="$(dirname "$0")/../.."
WEATHER_DIR="$PROJECT_DIR/weather-advice-cli"

if [ ! -d "$WEATHER_DIR" ]; then
    echo "weather-advice-cli ディレクトリが見つかりません: $WEATHER_DIR" >&2
    exit 0
fi

# npm test 実行
OUTPUT=$(cd "$WEATHER_DIR" && npm test 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ テスト失敗 (run-tests-on-save)" >&2
    echo "" >&2
    # 失敗したテストの要約を抽出
    SUMMARY=$(echo "$OUTPUT" | grep -E '(FAIL|×|✗|failed|Error:|AssertionError|expected|received)' | head -20)
    if [ -n "$SUMMARY" ]; then
        echo "$SUMMARY" >&2
    else
        # フォールバック: 末尾30行
        echo "$OUTPUT" | tail -30 >&2
    fi
    exit 1
fi

exit 0
