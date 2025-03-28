/**
 * 通知管理クラス
 * デスクトップ通知の表示を管理します
 */
import Singleton from '../utils/Singleton';
import EventEmitter from '../utils/EventEmitter';
import { Stream, Schedule } from './models';

class NotificationManager extends Singleton {
  constructor() {
    super();
    this.eventEmitter = new EventEmitter();
    this.notifiedStreamIds = new Set();
    this.notifiedScheduleIds = new Set();
    this.settings = null;
  }

  /**
   * 通知マネージャーを初期化します
   * @param {Object} settings - 通知設定
   */
  initialize(settings) {
    this.settings = settings;
    
    // 通知がクリックされたときのイベントリスナー
    chrome.notifications.onClicked.addListener(this.onNotificationClicked.bind(this));
    
    this.eventEmitter.emit('notification:initialized');
  }

  /**
   * 通知設定を更新します
   * @param {Object} settings - 新しい通知設定
   */
  updateSettings(settings) {
    this.settings = {
      ...this.settings,
      ...settings
    };
    this.eventEmitter.emit('notification:settingsUpdated', this.settings);
  }