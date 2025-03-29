/**
 * エラー管理クラス
 * アプリケーション全体のエラーを管理し、ユーザーへの表示やログを担当します
 */
import Singleton from '../utils/Singleton';
import EventEmitter from '../utils/EventEmitter';
import { Error as ErrorModel } from './models';

class ErrorManager extends Singleton {
  constructor() {
    super();
    this.eventEmitter = new EventEmitter();
    this.errors = [];
    this.maxErrorCount = 50; // 保持するエラーの最大数
  }

  /**
   * エラーマネージャーを初期化します
   */
  initialize() {
    this.errors = [];
    this.eventEmitter.emit('error:initialized');
  }

  /**
   * エラーを発生させます
   * @param {Object|string} errorData - エラー情報またはエラーメッセージ
   * @param {boolean} [notify=true] - エラーを通知するかどうか
   * @return {ErrorModel} - 作成されたエラーオブジェクト
   */
  reportError(errorData, notify = true) {
    const error = typeof errorData === 'string' 
      ? new ErrorModel({ message: errorData })
      : new ErrorModel(errorData);
    
    // エラーをリストに追加
    this.errors.unshift(error);
    
    // 最大数を超えた場合は古いエラーを削除
    if (this.errors.length > this.maxErrorCount) {
      this.errors = this.errors.slice(0, this.maxErrorCount);
    }
    
    // エラーイベントを発火
    this.eventEmitter.emit('error:reported', error);
    
    // 通知が必要な場合
    if (notify) {
      this.eventEmitter.emit('error:notify', error);
      
      // コンソールにもエラーを出力
      console.error(`[${error.code}] ${error.message}`, error.details || '');
    }
    
    return error;
  }

  /**
   * 最新のエラーを取得します
   * @param {number} [count=1] - 取得するエラーの数
   * @return {Array<ErrorModel>} - エラーの配列
   */
  getRecentErrors(count = 1) {
    return this.errors.slice(0, count);
  }

  /**
   * すべてのエラーを取得します
   * @return {Array<ErrorModel>} - すべてのエラーの配列
   */
  getAllErrors() {
    return [...this.errors];
  }

  /**
   * エラー履歴をクリアします
   */
  clearErrors() {
    this.errors = [];
    this.eventEmitter.emit('error:cleared');
  }

  /**
   * イベントリスナーを登録します
   * @param {string} event - イベント名
   * @param {Function} callback - コールバック関数
   */
  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  /**
   * イベントリスナーを解除します
   * @param {string} event - イベント名
   * @param {Function} callback - コールバック関数
   */
  off(event, callback) {
    this.eventEmitter.off(event, callback);
  }

  /**
   * UIにエラーメッセージを表示します
   * @param {string} message - 表示するメッセージ
   * @param {string} [level='error'] - エラーレベル ('error', 'warning', 'info')
   * @param {number} [duration=5000] - 表示時間（ミリ秒）
   */
  showUIMessage(message, level = 'error', duration = 5000) {
    this.eventEmitter.emit('error:showUI', { message, level, duration });
  }
}

export default ErrorManager;
