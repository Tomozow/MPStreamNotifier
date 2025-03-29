/**
 * イベントエミッタークラス
 * イベント駆動型アーキテクチャのためのシンプルなイベント管理機能を提供します
 */
class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  /**
   * イベントリスナーを登録します
   * @param {string} event - イベント名
   * @param {Function} callback - イベント発生時に呼び出されるコールバック関数
   * @return {EventEmitter} - メソッドチェーン用にthisを返す
   */
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    
    this.events.get(event).push(callback);
    return this;
  }

  /**
   * 一度だけ実行されるイベントリスナーを登録します
   * @param {string} event - イベント名
   * @param {Function} callback - イベント発生時に一度だけ呼び出されるコールバック関数
   * @return {EventEmitter} - メソッドチェーン用にthisを返す
   */
  once(event, callback) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      callback.apply(this, args);
    };
    
    this.on(event, onceWrapper);
    return this;
  }

  /**
   * イベントリスナーを解除します
   * @param {string} event - イベント名
   * @param {Function} [callback] - 特定のコールバック関数を解除する場合に指定
   * @return {EventEmitter} - メソッドチェーン用にthisを返す
   */
  off(event, callback) {
    if (!this.events.has(event)) {
      return this;
    }
    
    if (!callback) {
      // コールバックが指定されていない場合は、そのイベントのすべてのリスナーを削除
      this.events.delete(event);
      return this;
    }
    
    // 指定されたコールバック関数のみを削除
    const callbacks = this.events.get(event).filter(cb => cb !== callback);
    
    if (callbacks.length === 0) {
      this.events.delete(event);
    } else {
      this.events.set(event, callbacks);
    }
    
    return this;
  }

  /**
   * イベントを発火し、登録されたリスナーを実行します
   * @param {string} event - イベント名
   * @param {...any} args - リスナーに渡す引数
   * @return {boolean} - リスナーが呼び出されたかどうか
   */
  emit(event, ...args) {
    if (!this.events.has(event)) {
      return false;
    }
    
    const callbacks = this.events.get(event);
    callbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`EventEmitter: Error in callback for event "${event}":`, error);
      }
    });
    
    return true;
  }

  /**
   * 特定のイベントのリスナー数を取得します
   * @param {string} event - イベント名
   * @return {number} - リスナーの数
   */
  listenerCount(event) {
    if (!this.events.has(event)) {
      return 0;
    }
    
    return this.events.get(event).length;
  }

  /**
   * 登録済みのすべてのイベント名を取得します
   * @return {Array<string>} - イベント名の配列
   */
  eventNames() {
    return Array.from(this.events.keys());
  }
}

export default EventEmitter;