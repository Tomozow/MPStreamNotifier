# ユーティリティモジュール

このディレクトリには、アプリケーション全体で使用される共通ユーティリティが含まれています。

## EventEmitter

`EventEmitter` クラスはイベント駆動型アーキテクチャを実現するためのシンプルな実装です。これにより、アプリケーション内の異なるモジュール間で疎結合な通信が可能になります。

### 使用例

```javascript
import EventEmitter from './utils/EventEmitter';
import { DATA_EVENTS } from './utils/EventTypes';

// EventEmitterのインスタンスを作成
const emitter = new EventEmitter();

// イベントリスナーを登録
emitter.on(DATA_EVENTS.STREAMS_UPDATED, (streamData) => {
  console.log('ストリームデータが更新されました:', streamData);
});

// 一度だけ実行されるリスナーを登録
emitter.once(DATA_EVENTS.STREAM_ADDED, (newStream) => {
  console.log('新しいストリームが追加されました（この通知は一度だけ表示されます）:', newStream);
});

// イベントを発火
emitter.emit(DATA_EVENTS.STREAMS_UPDATED, { streams: [...] });

// リスナーを削除
const myListener = (data) => console.log(data);
emitter.on('customEvent', myListener);
emitter.off('customEvent', myListener); // 特定のリスナーを削除
emitter.off('customEvent'); // そのイベントのすべてのリスナーを削除
```

## EventTypes

`EventTypes` モジュールはアプリケーション全体で使用されるイベント名の定数を定義します。これにより、タイプミスを防ぎ、コード補完が機能するようになります。

### 使用例

```javascript
import { DATA_EVENTS, UI_EVENTS, AUTH_EVENTS, ALL_EVENTS } from './utils/EventTypes';

// カテゴリー別のイベントの使用
emitter.on(DATA_EVENTS.STREAM_STATUS_CHANGED, handleStatusChange);
emitter.on(UI_EVENTS.TAB_CHANGED, handleTabChange);
emitter.on(AUTH_EVENTS.AUTH_TOKEN_EXPIRED, refreshToken);

// すべてのイベントを含む定数からの使用も可能
emitter.on(ALL_EVENTS.STREAM_ADDED, handleNewStream);
```

## Singleton

`Singleton` クラスは、アプリケーション内で単一のインスタンスしか持たないクラスを実装するための基底クラスです。

### 使用例

```javascript
import Singleton from './utils/Singleton';

class DataManager extends Singleton {
  constructor() {
    super();
    this.data = [];
  }
  
  addItem(item) {
    this.data.push(item);
  }
}

// インスタンス取得（常に同じインスタンスが返される）
const manager1 = DataManager.getInstance();
const manager2 = DataManager.getInstance();

console.log(manager1 === manager2); // true

// テスト用にインスタンスをリセットする場合
DataManager.destroyInstance();
```
