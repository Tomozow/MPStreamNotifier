// バックグラウンドサービス
// Chrome拡張機能のバックグラウンドで動作し、定期的にAPIからデータを取得する

// 仮の設定値
let settings = {
  updateInterval: 5, // 分単位での更新間隔
  startupRefresh: true, // 起動時に更新するかどうか
  enableNotifications: true // 通知を有効にするかどうか
};

// 拡張機能のインストール/更新時の処理
chrome.runtime.onInstalled.addListener(details => {
  console.log('MPStreamNotifier installed or updated:', details.reason);
  
  // デフォルト設定の初期化
  initializeDefaultSettings();
  
  // アラームを設定
  setupAlarm();
});

// 拡張機能起動時の処理
chrome.runtime.onStartup.addListener(() => {
  console.log('MPStreamNotifier started');
  
  // 設定を読み込む
  loadSettings().then(() => {
    // 設定に基づいてアラームを設定
    setupAlarm();
    
    // 起動時の更新が有効なら更新を実行
    if (settings.startupRefresh) {
      fetchStreamData();
    }
  });
});

// メッセージリスナー（他のスクリプトからのメッセージを処理）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.type === 'refresh') {
    // 手動更新リクエスト
    fetchStreamData().then(data => {
      sendResponse({ success: true, data });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // 非同期レスポンスを示す
  }
  
  if (message.type === 'settings_updated') {
    // 設定が更新された
    loadSettings().then(() => {
      // アラームの更新
      setupAlarm();
      sendResponse({ success: true });
    });
    return true; // 非同期レスポンスを示す
  }
  
  if (message.type === 'twitch_authenticated') {
    // Twitch認証状態が更新された
    console.log('Twitch authentication updated:', message.auth);
    
    // 次回のデータ取得時に認証情報が使用されるようにする
    updateBadge('↻'); // 更新マークを表示
    
    // データの再取得をスケジュール
    chrome.alarms.create('fetchStreamData', {
      delayInMinutes: 0.1 // 6秒後に実行
    });
    
    sendResponse({ success: true });
    return true;
  }
});

// アラームリスナー（定期的な更新処理を実行）
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'fetchStreamData') {
    console.log('Alarm triggered: fetchStreamData');
    fetchStreamData();
  }
});

// デフォルト設定の初期化
function initializeDefaultSettings() {
  const defaultSettings = {
    updateInterval: 5,
    startupRefresh: true,
    enableNotifications: true,
    notifyFavoritesOnly: false,
    notificationDuration: 10,
    twitchClientId: '',
    youtubeApiKey: '',
    twitcastingClientId: ''
  };
  
  chrome.storage.local.get('settings', result => {
    if (!result.settings) {
      chrome.storage.local.set({ settings: defaultSettings }, () => {
        console.log('Default settings initialized');
        settings = defaultSettings;
      });
    } else {
      console.log('Settings already exist');
      settings = result.settings;
    }
  });
}

// 設定の読み込み
async function loadSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('settings', result => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        settings = result.settings || {
          updateInterval: 5,
          startupRefresh: true,
          enableNotifications: true
        };
        console.log('Settings loaded:', settings);
        resolve(settings);
      }
    });
  });
}

// アラームを設定（定期的な更新用）
function setupAlarm() {
  // 既存のアラームをクリア
  chrome.alarms.clear('fetchStreamData', () => {
    // 新しいアラームを作成
    chrome.alarms.create('fetchStreamData', {
      delayInMinutes: 0.1, // 初回実行を少し遅らせる
      periodInMinutes: settings.updateInterval
    });
    
    console.log(`Alarm set to run every ${settings.updateInterval} minutes`);
  });
}

// ストリームデータを取得（ここでAPIリクエストを実装）
async function fetchStreamData() {
  try {
    console.log('Fetching stream data...');
    
    // バッジカウンターを更新（ロード中表示）
    updateBadge('...');
    
    // TODO: 本来はここで各APIからデータを取得する処理を実装
    // 仮実装：タイムアウトでダミーデータを返す
    const dummyData = await new Promise(resolve => {
      setTimeout(() => {
        resolve({
          streams: [
            { platform: 'twitch', title: 'テスト配信 1', viewers: 123 },
            { platform: 'youtube', title: 'テスト配信 2', viewers: 456 }
          ]
        });
      }, 1000);
    });
    
    console.log('Stream data fetched:', dummyData);
    
    // 取得したデータを保存
    saveStreamData(dummyData);
    
    // バッジを更新
    updateBadge(dummyData.streams.length.toString());
    
    // 新規配信がある場合は通知
    checkForNewStreams(dummyData.streams);
    
    return dummyData;
  } catch (error) {
    console.error('Error fetching stream data:', error);
    
    // エラー時のバッジ表示
    updateBadge('!');
    throw error;
  }
}

// 取得したデータをローカルストレージに保存
function saveStreamData(data) {
  chrome.storage.local.set({ 
    streamData: data,
    lastUpdated: new Date().toISOString()
  }, () => {
    console.log('Stream data saved to storage');
  });
}

// バッジカウンターを更新
function updateBadge(text) {
  chrome.action.setBadgeText({ text });
  
  // バッジの色を設定
  if (text === '!') {
    chrome.action.setBadgeBackgroundColor({ color: '#f55353' }); // エラー時は赤
  } else if (text === '...') {
    chrome.action.setBadgeBackgroundColor({ color: '#777777' }); // ロード中はグレー
  } else if (text === '↻') {
    chrome.action.setBadgeBackgroundColor({ color: '#00b173' }); // 更新予定は緑
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#9147ff' }); // 通常時はTwitch紫
  }
}

// 新規配信の確認と通知
function checkForNewStreams(currentStreams) {
  if (!settings.enableNotifications) {
    return; // 通知が無効な場合は何もしない
  }
  
  // 前回のデータを取得
  chrome.storage.local.get('previousStreams', result => {
    const previousStreams = result.previousStreams || [];
    
    // 新規配信を特定
    const newStreams = currentStreams.filter(current => {
      return !previousStreams.some(previous => 
        previous.platform === current.platform && 
        previous.title === current.title
      );
    });
    
    console.log('New streams:', newStreams);
    
    // 新規配信があれば通知
    if (newStreams.length > 0) {
      showNotifications(newStreams);
    }
    
    // 現在のストリームを前回のデータとして保存
    chrome.storage.local.set({ previousStreams: currentStreams });
  });
}

// 通知を表示
function showNotifications(streams) {
  streams.forEach(stream => {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/assets/icon128.png',
      title: '新しい配信が開始されました',
      message: `${stream.title} (${stream.platform})`,
      contextMessage: `視聴者数: ${stream.viewers}`,
      priority: 2,
      silent: false
    });
  });
}

// 初期化時に設定を読み込む
loadSettings();
