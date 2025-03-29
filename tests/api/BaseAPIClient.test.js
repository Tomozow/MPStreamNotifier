/**
 * BaseAPIClient クラスのテスト
 */
import BaseAPIClient from '../../src/api/BaseAPIClient';

// モックのフェッチ
global.fetch = jest.fn();

describe('BaseAPIClient', () => {
  let apiClient;
  
  beforeEach(() => {
    // テスト前にフェッチをリセット
    global.fetch.mockReset();
    
    // BaseAPIClientのインスタンスを作成
    apiClient = new BaseAPIClient('test-platform');
  });
  
  test('コンストラクタが適切にプロパティを初期化すること', () => {
    expect(apiClient.platformType).toBe('test-platform');
    expect(apiClient.isInitialized).toBe(false);
    expect(apiClient.maxRetries).toBe(3);
    expect(apiClient.retryDelay).toBe(1000);
    expect(apiClient.requestTimeout).toBe(10000);
    expect(apiClient.activeRequests.size).toBe(0);
    expect(apiClient.rateLimitInfo).toEqual({
      limit: null,
      remaining: null,
      resetTime: null
    });
  });
  
  test('initialize()が適切にinitializedイベントを発火すること', async () => {
    // イベントリスナーをモック
    const mockListener = jest.fn();
    apiClient.on('client:initialized', mockListener);
    
    await apiClient.initialize();
    
    expect(apiClient.isInitialized).toBe(true);
    expect(mockListener).toHaveBeenCalledWith('test-platform');
  });
  
  test('getDefaultRequestOptions()が適切なデフォルトオプションを返すこと', () => {
    const options = apiClient.getDefaultRequestOptions();
    
    expect(options).toEqual({
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      credentials: 'omit'
    });
  });
  
  test('request()が成功時に適切にデータを返すこと', async () => {
    // レスポンスをモック
    const mockResponse = {
      ok: true,
      headers: {
        get: jest.fn()
      },
      json: jest.fn().mockResolvedValue({ data: 'test-data' })
    };
    
    global.fetch.mockResolvedValue(mockResponse);
    
    // リクエスト
    const result = await apiClient.request('https://test-api.com/endpoint');
    
    // フェッチが正しく呼び出されたことを確認
    expect(global.fetch).toHaveBeenCalledWith('https://test-api.com/endpoint', expect.any(Object));
    
    // レスポンスが適切に解析されたことを確認
    expect(mockResponse.json).toHaveBeenCalled();
    expect(result).toEqual({ data: 'test-data' });
  });
  
  test('request()がエラー時に適切なエラーを投げること', async () => {
    // エラーレスポンスをモック
    const mockErrorResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: {
        get: jest.fn()
      }
    };
    
    global.fetch.mockResolvedValue(mockErrorResponse);
    
    // エラーイベントリスナーをモック
    const mockErrorListener = jest.fn();
    apiClient.on('client:error', mockErrorListener);
    
    // リクエストがエラーになることを期待
    await expect(apiClient.request('https://test-api.com/endpoint')).rejects.toThrow();
    
    // エラーイベントが発火されたことを確認
    expect(mockErrorListener).toHaveBeenCalled();
  });
  
  test('parseResponse()がJSONレスポンスを適切に解析すること', async () => {
    const jsonResponse = {
      headers: {
        get: jest.fn().mockReturnValue('application/json')
      },
      json: jest.fn().mockResolvedValue({ data: 'test-json' })
    };
    
    const result = await apiClient.parseResponse(jsonResponse);
    
    expect(jsonResponse.json).toHaveBeenCalled();
    expect(result).toEqual({ data: 'test-json' });
  });
  
  test('parseResponse()がテキストレスポンスを適切に解析すること', async () => {
    const textResponse = {
      headers: {
        get: jest.fn().mockReturnValue('text/plain')
      },
      text: jest.fn().mockResolvedValue('test-text')
    };
    
    const result = await apiClient.parseResponse(textResponse);
    
    expect(textResponse.text).toHaveBeenCalled();
    expect(result).toBe('test-text');
  });
  
  test('cancelAllRequests()がすべてのリクエストをキャンセルすること', () => {
    // モックのアクティブリクエスト
    const mockController1 = { abort: jest.fn() };
    const mockController2 = { abort: jest.fn() };
    
    apiClient.activeRequests.set('request1', { controller: mockController1 });
    apiClient.activeRequests.set('request2', { controller: mockController2 });
    
    apiClient.cancelAllRequests();
    
    expect(mockController1.abort).toHaveBeenCalled();
    expect(mockController2.abort).toHaveBeenCalled();
    expect(apiClient.activeRequests.size).toBe(0);
  });
  
  test('未実装のメソッドが適切なエラーを投げること', async () => {
    await expect(apiClient.getStreams()).rejects.toThrow('getStreams メソッドが実装されていません');
    await expect(apiClient.getSchedules()).rejects.toThrow('getSchedules メソッドが実装されていません');
    await expect(apiClient.authenticate()).rejects.toThrow('authenticate メソッドが実装されていません');
  });
});