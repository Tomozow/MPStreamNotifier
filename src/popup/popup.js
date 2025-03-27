import './popup.css';

// UIコントローラーの定義
class UIController {
  constructor() {
    this.elements = {
      refreshButton: document.getElementById('refresh-button'),
      settingsButton: document.getElementById('settings-button'),
      allTab: document.getElementById('all-tab'),
      twitchTab: document.getElementById('twitch-tab'),
      youtubeTab: document.getElementById('youtube-tab'),
      twitcastingTab: document.getElementById('twitcasting-tab'),
      filterButton: document.getElementById('filter-button'),
      filterPanel: document.getElementById('filter-panel'),
      streamsContainer: document.getElementById('streams-container'),
      errorContainer: document.getElementById('error-container'),
      scheduleButton: document.getElementById('schedule-button'),
      favoritesButton: document.getElementById('favorites-button'),
    };
    
    this.activeTab = 'all';
    this.isFilterVisible = false;
    
    this.bindEvents();
    this.init();
  }
  
  bindEvents() {
    // リフレッシュボタン
    this.elements.refreshButton.addEventListener('click', () => {
      this.refreshData();
    });
    
    // 設定ボタン
    this.elements.settingsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    
    // タブ切り替え
    this.elements.allTab.addEventListener('click', () => this.changeTab('all'));
    this.elements.twitchTab.addEventListener('click', () => this.changeTab('twitch'));
    this.elements.youtubeTab.addEventListener('click', () => this.changeTab('youtube'));
    this.elements.twitcastingTab.addEventListener('click', () => this.changeTab('twitcasting'));
    
    // フィルターボタン
    this.elements.filterButton.addEventListener('click', () => {
      this.toggleFilterPanel();
    });
    
    // スケジュールボタン
    this.elements.scheduleButton.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('schedule.html') });
    });
    
    // お気に入りボタン
    this.elements.favoritesButton.addEventListener('click', () => {
      this.toggleFavorites();
    });
  }
  
  init() {
    this.loadInitialData();
  }
  
  loadInitialData() {
    // バックグラウンドからデータを取得する仮実装
    this.showLoadingState();
    
    // TODO: 実際のデータ取得処理に置き換える
    setTimeout(() => {
      this.hideLoadingState();
      
      // テスト用の空の状態を表示
      this.elements.streamsContainer.innerHTML = '<div class="loading-indicator">データがありません</div>';
    }, 500);
  }
  
  refreshData() {
    // データ更新処理の仮実装
    this.showLoadingState();
    
    // TODO: 実際のデータ更新処理に置き換える
    setTimeout(() => {
      this.hideLoadingState();
    }, 500);
  }
  
  changeTab(tabName) {
    // アクティブタブのクラスを切り替え
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    this.activeTab = tabName;
    
    // TODO: 選択されたタブに応じたデータフィルタリング
    this.refreshData();
  }
  
  toggleFilterPanel() {
    this.isFilterVisible = !this.isFilterVisible;
    this.elements.filterPanel.classList.toggle('hidden', !this.isFilterVisible);
  }
  
  toggleFavorites() {
    // TODO: お気に入り表示の切り替え処理
  }
  
  showLoadingState() {
    this.elements.streamsContainer.innerHTML = '<div class="loading-indicator"><span>読み込み中...</span></div>';
  }
  
  hideLoadingState() {
    // loadingIndicatorは個別のデータ読み込み完了後に置き換える
  }
  
  showError(message) {
    this.elements.errorContainer.textContent = message;
    this.elements.errorContainer.classList.remove('hidden');
  }
  
  hideError() {
    this.elements.errorContainer.classList.add('hidden');
  }
}

// ポップアップ読み込み時にUIコントローラーを初期化
document.addEventListener('DOMContentLoaded', () => {
  new UIController();
});
