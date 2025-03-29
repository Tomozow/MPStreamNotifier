import '../ui/styles/options.css';
import { TwitchAPIClient } from '../api';

// 設定マネージャークラス
class SettingsManager {
  constructor() {
    this.defaultSettings = {
      updateInterval: 5, // 分単位での更新間隔
      startupRefresh: true, // 起動時に更新するかどうか
      enableNotifications: true, // 通知を有効にするかどうか
      notifyFavoritesOnly: false, // お気に入りのみ通知するかどうか
      notificationDuration: 10, // 通知表示時間（秒）
      twitchClientId: '', // Twitch API Client ID
      youtubeApiKey: '', // YouTube API Key
      twitcastingClientId: '' // TwitCasting Client ID
    };
    
    this.settings = { ...this.defaultSettings };
  }

  // 設定を保存
  async saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ settings: this.settings }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(this.settings);
        }
      });
    });
  }

  // 設定を読み込み
  async loadSettings() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('settings', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          this.settings = result.settings || { ...this.defaultSettings };
          resolve(this.settings);
        }
      });
    });
  }

  // 設定をリセット
  async resetSettings() {
    this.settings = { ...this.defaultSettings };
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ settings: this.settings }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(this.settings);
        }
      });
    });
  }
  
  // 特定の設定値を取得
  getSetting(key) {
    return this.settings[key];
  }
}

// UI管理クラス
class OptionsUIController {
  constructor() {
    this.settingsManager = new SettingsManager();
    this.initDomReferences();
    this.bindEvents();
    this.init();
  }

  // DOM要素の参照を取得
  initDomReferences() {
    this.updateIntervalInput = document.getElementById('updateInterval');
    this.startupRefreshCheckbox = document.getElementById('startupRefresh');
    this.enableNotificationsCheckbox = document.getElementById('enableNotifications');
    this.notifyFavoritesOnlyCheckbox = document.getElementById('notifyFavoritesOnly');
    this.notificationDurationInput = document.getElementById('notificationDuration');
    this.twitchClientIdInput = document.getElementById('twitchClientId');
    this.youtubeApiKeyInput = document.getElementById('youtubeApiKey');
    this.twitcastingClientIdInput = document.getElementById('twitcastingClientId');
    this.twitchAuthButton = document.getElementById('twitchAuth');
    this.twitchAuthStatus = document.getElementById('twitchAuthStatus');
    this.saveButton = document.getElementById('saveSettings');
    this.resetButton = document.getElementById('resetSettings');
    this.statusMessage = document.getElementById('statusMessage');
  }

  // イベントハンドラを登録
  bindEvents() {
    this.saveButton.addEventListener('click', () => this.saveSettings());
    this.resetButton.addEventListener('click', () => this.resetSettings());
    this.twitchAuthButton.addEventListener('click', () => this.authenticateWithTwitch());
  }

  // 初期化
  async init() {
    try {
      const settings = await this.settingsManager.loadSettings();
      this.populateForm(settings);
      
      // Twitch認証状態の確認
      await this.checkTwitchAuthStatus();
    } catch (error) {
      this.showStatusMessage('設定の読み込みに失敗しました', true);
      console.error('Failed to load settings:', error);
    }
  }
  
  // Twitch認証状態の確認
  async checkTwitchAuthStatus() {
    try {
      const result = await chrome.storage.local.get('twitch_auth');
      if (result.twitch_auth && result.twitch_auth.isAuthorized) {
        this.twitchAuthStatus.textContent = `認証済み: ${result.twitch_auth.userName || 'Unknown'}`;
        this.twitchAuthStatus.classList.add('authenticated');
      } else {
        this.twitchAuthStatus.textContent = '未認証';
        this.twitchAuthStatus.classList.remove('authenticated');
      }
    } catch (error) {
      console.error('Twitch認証状態の確認に失敗しました', error);
      this.twitchAuthStatus.textContent = '認証状態の確認に失敗';
      this.twitchAuthStatus.classList.remove('authenticated');
    }
  }
  
  // Twitchでの認証を実行
  async authenticateWithTwitch() {
    try {
      // Client IDが設定されているか確認
      const clientId = this.twitchClientIdInput.value.trim();
      if (!clientId) {
        this.showStatusMessage('Twitch Client IDを入力してください', true);
        return;
      }
      
      // 認証中の表示
      this.twitchAuthButton.disabled = true;
      this.twitchAuthStatus.textContent = '認証中...';
      
      // 設定を一時保存
      await this.settingsManager.saveSettings({
        twitchClientId: clientId
      });
      
      // Twitch APIクライアントの作成
      const twitchClient = new TwitchAPIClient();
      await twitchClient.initialize({ clientId });
      
      // 認証を実行
      const authResult = await twitchClient.authenticate();
      
      // 認証結果の表示
      if (authResult.isAuthorized) {
        this.twitchAuthStatus.textContent = `認証済み: ${authResult.userName}`;
        this.twitchAuthStatus.classList.add('authenticated');
        this.showStatusMessage('Twitchの認証に成功しました');
        
        // バックグラウンドスクリプトに通知
        chrome.runtime.sendMessage({ 
          type: 'twitch_authenticated',
          auth: authResult
        });
      } else {
        this.twitchAuthStatus.textContent = '認証に失敗しました';
        this.twitchAuthStatus.classList.remove('authenticated');
        this.showStatusMessage('Twitchの認証に失敗しました', true);
      }
    } catch (error) {
      console.error('Twitch認証エラー:', error);
      this.twitchAuthStatus.textContent = '認証エラー';
      this.twitchAuthStatus.classList.remove('authenticated');
      this.showStatusMessage(`Twitchの認証に失敗しました: ${error.message}`, true);
    } finally {
      this.twitchAuthButton.disabled = false;
    }
  }

  // フォームに設定値を反映
  populateForm(settings) {
    this.updateIntervalInput.value = settings.updateInterval;
    this.startupRefreshCheckbox.checked = settings.startupRefresh;
    this.enableNotificationsCheckbox.checked = settings.enableNotifications;
    this.notifyFavoritesOnlyCheckbox.checked = settings.notifyFavoritesOnly;
    this.notificationDurationInput.value = settings.notificationDuration;
    this.twitchClientIdInput.value = settings.twitchClientId;
    this.youtubeApiKeyInput.value = settings.youtubeApiKey;
    this.twitcastingClientIdInput.value = settings.twitcastingClientId;
  }

  // フォームから設定値を取得
  getFormValues() {
    return {
      updateInterval: parseInt(this.updateIntervalInput.value, 10),
      startupRefresh: this.startupRefreshCheckbox.checked,
      enableNotifications: this.enableNotificationsCheckbox.checked,
      notifyFavoritesOnly: this.notifyFavoritesOnlyCheckbox.checked,
      notificationDuration: parseInt(this.notificationDurationInput.value, 10),
      twitchClientId: this.twitchClientIdInput.value.trim(),
      youtubeApiKey: this.youtubeApiKeyInput.value.trim(),
      twitcastingClientId: this.twitcastingClientIdInput.value.trim()
    };
  }

  // 設定を保存
  async saveSettings() {
    try {
      const settings = this.getFormValues();
      await this.settingsManager.saveSettings(settings);
      this.showStatusMessage('設定を保存しました');
      
      // 更新間隔が変更された場合はバックグラウンドスクリプトに通知
      chrome.runtime.sendMessage({ type: 'settings_updated' });
    } catch (error) {
      this.showStatusMessage('設定の保存に失敗しました', true);
      console.error('Failed to save settings:', error);
    }
  }

  // 設定をリセット
  async resetSettings() {
    try {
      const settings = await this.settingsManager.resetSettings();
      this.populateForm(settings);
      this.showStatusMessage('設定をリセットしました');
      
      // バックグラウンドスクリプトに通知
      chrome.runtime.sendMessage({ type: 'settings_updated' });
    } catch (error) {
      this.showStatusMessage('設定のリセットに失敗しました', true);
      console.error('Failed to reset settings:', error);
    }
  }

  // ステータスメッセージを表示
  showStatusMessage(message, isError = false) {
    this.statusMessage.textContent = message;
    this.statusMessage.classList.remove('hidden');
    this.statusMessage.classList.toggle('error', isError);
    
    // 3秒後にメッセージを消す
    setTimeout(() => {
      this.statusMessage.classList.add('hidden');
    }, 3000);
  }
}

// 設定ページの初期化
document.addEventListener('DOMContentLoaded', () => {
  const ui = new OptionsUIController();
});
