/**
 * 設定管理クラス
 * アプリケーション設定を管理し、永続化を担当します
 */
import Singleton from '../utils/Singleton';
import EventEmitter from '../utils/EventEmitter';
import { Settings } from './models';

class SettingsManager extends Singleton {
  constructor() {
    super();
    this.eventEmitter = new EventEmitter();
    this.settings = new Settings();
    this.isLoading = false;
  }

  /**
   * 設定を初期化します
   * @return {Promise<Settings>}
   */
  async initialize() {
    this.isLoading = true;
    try {
      await this.loadSettings();
      this.isLoading = false;
      this.eventEmitter.emit('settings:initialized', this.settings);
      return this.settings;
    } catch (error) {
      this.isLoading = false;
      this.eventEmitter.emit('error', {
        code: 'SETTINGS_INIT_ERROR',
        message: '設定の初期化に失敗しました',
        details: error
      });
      throw error;
    }
  }

  /**
   * 設定を保存します
   * @param {Settings|Object} [newSettings] - 新しい設定（省略時は現在の設定を保存）
   * @return {Promise<Settings>}
   */
  async saveSettings(newSettings = null) {
    try {
      if (newSettings) {
        this.settings = newSettings instanceof Settings 
          ? newSettings 
          : new Settings(newSettings);
      }
      
      await new Promise((resolve) => {
        chrome.storage.local.set({ 'settings': this.settings }, resolve);
      });
      
      this.eventEmitter.emit('settings:saved', this.settings);
      return this.settings;
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'SETTINGS_SAVE_ERROR',
        message: '設定の保存に失敗しました',
        details: error
      });
      throw error;
    }
  }

  /**
   * 設定を読み込みます
   * @return {Promise<Settings>}
   */
  async loadSettings() {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.get('settings', (result) => {
          const data = result.settings || {};
          this.settings = new Settings(data);
          resolve(this.settings);
        });
      });
    } catch (error) {
      this.eventEmitter.emit('error', {
        code: 'SETTINGS_LOAD_ERROR',
        message: '設定の読み込みに失敗しました',
        details: error
      });
      throw error;
    }
  }

  /**
   * 特定の設定値を取得します
   * @param {string} key - 設定キー
   * @param {*} [defaultValue] - デフォルト値
   * @return {*} - 設定値
   */
  getSetting(key, defaultValue) {
    return key in this.settings ? this.settings[key] : defaultValue;
  }

  /**
   * 特定の設定値を更新します
   * @param {string} key - 設定キー
   * @param {*} value - 設定値
   * @param {boolean} [autoSave=true] - 自動保存するかどうか
   * @return {Promise<Settings>}
   */
  async updateSetting(key, value, autoSave = true) {
    const oldValue = this.settings[key];
    
    // 値が異なる場合のみ更新
    if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
      this.settings[key] = value;
      
      this.eventEmitter.emit('settings:updated', {
        key,
        newValue: value,
        oldValue
      });
      
      if (autoSave) {
        return this.saveSettings();
      }
    }
    
    return this.settings;
  }

  /**
   * 複数の設定値を一括更新します
   * @param {Object} updates - 更新する設定のオブジェクト
   * @param {boolean} [autoSave=true] - 自動保存するかどうか
   * @return {Promise<Settings>}
   */
  async updateSettings(updates, autoSave = true) {
    const changedKeys = [];
    const oldValues = {};
    
    // 変更がある項目のみ更新
    Object.entries(updates).forEach(([key, value]) => {
      if (this.settings[key] !== undefined && 
          JSON.stringify(this.settings[key]) !== JSON.stringify(value)) {
        oldValues[key] = this.settings[key];
        this.settings[key] = value;
        changedKeys.push(key);
      }
    });
    
    if (changedKeys.length > 0) {
      this.eventEmitter.emit('settings:bulkUpdated', {
        changedKeys,
        oldValues,
        newValues: updates
      });
      
      if (autoSave) {
        return this.saveSettings();
      }
    }
    
    return this.settings;
  }

  /**
   * 設定を既定値にリセットします
   * @param {boolean} [autoSave=true] - 自動保存するかどうか
   * @return {Promise<Settings>}
   */
  async resetSettings(autoSave = true) {
    const oldSettings = { ...this.settings };
    this.settings = new Settings();
    
    this.eventEmitter.emit('settings:reset', {
      oldSettings,
      newSettings: this.settings
    });
    
    if (autoSave) {
      return this.saveSettings();
    }
    
    return this.settings;
  }

  /**
   * お気に入り配信者を追加します
   * @param {string} streamerId - 配信者ID
   * @return {Promise<Array<string>>} - 更新されたお気に入りリスト
   */
  async addFavorite(streamerId) {
    if (!this.settings.favorites.includes(streamerId)) {
      const favorites = [...this.settings.favorites, streamerId];
      await this.updateSetting('favorites', favorites);
      return favorites;
    }
    return this.settings.favorites;
  }

  /**
   * お気に入り配信者を削除します
   * @param {string} streamerId - 配信者ID
   * @return {Promise<Array<string>>} - 更新されたお気に入りリスト
   */
  async removeFavorite(streamerId) {
    if (this.settings.favorites.includes(streamerId)) {
      const favorites = this.settings.favorites.filter(id => id !== streamerId);
      await this.updateSetting('favorites', favorites);
      return favorites;
    }
    return this.settings.favorites;
  }

  /**
   * お気に入り配信者をトグルします
   * @param {string} streamerId - 配信者ID
   * @return {Promise<{favorites: Array<string>, isFavorite: boolean}>} - 更新されたお気に入りリストとお気に入り状態
   */
  async toggleFavorite(streamerId) {
    const isFavorite = this.settings.favorites.includes(streamerId);
    
    if (isFavorite) {
      const favorites = await this.removeFavorite(streamerId);
      return { favorites, isFavorite: false };
    } else {
      const favorites = await this.addFavorite(streamerId);
      return { favorites, isFavorite: true };
    }
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
}

export default SettingsManager;