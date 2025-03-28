/**
 * EventEmitter と EventTypes のテスト
 */
import EventEmitter from '../../src/utils/EventEmitter';
import { DATA_EVENTS, UI_EVENTS } from '../../src/utils/EventTypes';

describe('EventEmitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  test('should register and trigger event listeners', () => {
    const mockCallback = jest.fn();
    emitter.on('testEvent', mockCallback);
    
    emitter.emit('testEvent', 'arg1', 'arg2');
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith('arg1', 'arg2');
  });

  test('should handle multiple listeners for the same event', () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();
    
    emitter.on('testEvent', mockCallback1);
    emitter.on('testEvent', mockCallback2);
    
    emitter.emit('testEvent', 'data');
    
    expect(mockCallback1).toHaveBeenCalledTimes(1);
    expect(mockCallback2).toHaveBeenCalledTimes(1);
    expect(mockCallback1).toHaveBeenCalledWith('data');
    expect(mockCallback2).toHaveBeenCalledWith('data');
  });

  test('should remove specific event listeners', () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();
    
    emitter.on('testEvent', mockCallback1);
    emitter.on('testEvent', mockCallback2);
    
    emitter.off('testEvent', mockCallback1);
    emitter.emit('testEvent');
    
    expect(mockCallback1).not.toHaveBeenCalled();
    expect(mockCallback2).toHaveBeenCalledTimes(1);
  });

  test('should remove all listeners for an event', () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();
    
    emitter.on('testEvent', mockCallback1);
    emitter.on('testEvent', mockCallback2);
    
    emitter.off('testEvent');
    emitter.emit('testEvent');
    
    expect(mockCallback1).not.toHaveBeenCalled();
    expect(mockCallback2).not.toHaveBeenCalled();
  });

  test('should execute once listeners only one time', () => {
    const mockCallback = jest.fn();
    
    emitter.once('testEvent', mockCallback);
    
    emitter.emit('testEvent', 'first');
    emitter.emit('testEvent', 'second');
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith('first');
  });

  test('should return listener count', () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();
    
    expect(emitter.listenerCount('testEvent')).toBe(0);
    
    emitter.on('testEvent', mockCallback1);
    expect(emitter.listenerCount('testEvent')).toBe(1);
    
    emitter.on('testEvent', mockCallback2);
    expect(emitter.listenerCount('testEvent')).toBe(2);
    
    emitter.off('testEvent', mockCallback1);
    expect(emitter.listenerCount('testEvent')).toBe(1);
    
    emitter.off('testEvent');
    expect(emitter.listenerCount('testEvent')).toBe(0);
  });
});

describe('EventTypes integration with EventEmitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  test('should work with DATA_EVENTS constants', () => {
    const mockCallback = jest.fn();
    
    emitter.on(DATA_EVENTS.STREAMS_UPDATED, mockCallback);
    
    emitter.emit(DATA_EVENTS.STREAMS_UPDATED, { streams: [{ id: 1, title: 'Test Stream' }] });
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith({ streams: [{ id: 1, title: 'Test Stream' }] });
  });

  test('should work with UI_EVENTS constants', () => {
    const mockCallback = jest.fn();
    
    emitter.on(UI_EVENTS.TAB_CHANGED, mockCallback);
    
    emitter.emit(UI_EVENTS.TAB_CHANGED, 'twitch');
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith('twitch');
  });
});
