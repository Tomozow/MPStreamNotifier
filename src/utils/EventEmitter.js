/**
 * イベントエミッターの実装
 * シンプルな Observer パターンを提供し、各モジュール間で疎結合な通信を実現します
 */
class EventEmitter {
  constructor() {
    this._events = {};
  }

  /**
   * イベントリスナーを登録します
   * @param {string} event - イベント名
   * @param {function} listener - リスナー関数
   * @return {EventEmitter} - メソッドチェーン用のインスタンス自身
   */
  on(event, listener) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(listener);
    return this;
  }

  /**
   * 一度だけ実行されるイベントリスナーを登録します
   * @param {string} event - イベント名
   * @param {function} listener - リスナー関数
   * @return {EventEmitter} - メソッドチェーン用のインスタンス自身
   */
  once(event, listener) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      listener.apply(this, args);
    };
    return this.on(event, onceWrapper);
  }

  /**
   * イベントリスナーを解除します
   * @param {string} event - イベント名
   * @param {function} [listener] - リスナー関数（省略時は該当イベントのすべてのリスナーを解除）
   * @return {EventEmitter} - メソッドチェーン用のインスタンス自身
   */
  off(event, listener) {
    if (!this._events[event]) return this;

    if (!listener) {
      delete this._events[event];
      return this;
    }

    const idx = this._events[event].indexOf(listener);
    if (idx !== -1) {
      this._events[event].splice(idx, 1);
    }
    return this;
  }

  /**
   * イベントを発火します
   * @param {string} event - イベント名
   * @param {...any} args - リスナーに渡す引数
   * @return {boolean} - リスナーが存在した場合true
   */
  emit(event, ...args) {
    if (!this._events[event]) return false;

    this._events[event].forEach((listener) => {
      listener.apply(this, args);
    });
    return true;
  }

  /**
   * 登録されているリスナーの数を返します
   * @param {string} event - イベント名
   * @return {number} - リスナーの数
   */
  listenerCount(event) {
    return this._events[event] ? this._events[event].length : 0;
  }
}

export default EventEmitter;
