import { ref, onMounted, onUnmounted } from 'vue';

const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket(url: string) {
  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const messageListeners = new Map<string, Set<(data: any) => void>>();
  let reconnectAttempts = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    try {
      ws.value = new WebSocket(url);

      ws.value.onopen = () => {
        isConnected.value = true;
        reconnectAttempts = 0;
        if (import.meta.env.DEV) console.log('WebSocket connected');
      };

      ws.value.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const listeners = messageListeners.get(message.type);
          if (listeners) {
            listeners.forEach(callback => callback(message.data));
          }
        } catch (error) {
          if (import.meta.env.DEV) console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.value.onerror = (error) => {
        if (import.meta.env.DEV) console.error('WebSocket error:', error);
      };

      ws.value.onclose = () => {
        isConnected.value = false;
        if (import.meta.env.DEV) console.log('WebSocket disconnected');

        // Reconnect with exponential backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;
          reconnectAttempts++;
          if (import.meta.env.DEV) console.log(`WebSocket reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
          reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            if (!isConnected.value) {
              connect();
            }
          }, delay);
        } else {
          if (import.meta.env.DEV) console.error(`WebSocket reconnection failed after ${MAX_RECONNECT_ATTEMPTS} attempts`);
        }
      };
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error connecting WebSocket:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeout !== null) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent onclose from scheduling reconnect
    if (ws.value) {
      ws.value.close();
      ws.value = null;
      isConnected.value = false;
    }
  };

  const send = (type: string, data: any) => {
    if (ws.value && isConnected.value) {
      ws.value.send(JSON.stringify({ type, data }));
    } else {
      if (import.meta.env.DEV) console.warn('WebSocket not connected, cannot send message');
    }
  };

  const on = (type: string, callback: (data: any) => void) => {
    if (!messageListeners.has(type)) {
      messageListeners.set(type, new Set());
    }
    messageListeners.get(type)!.add(callback);
  };

  const off = (type: string, callback: (data: any) => void) => {
    const listeners = messageListeners.get(type);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        messageListeners.delete(type);
      }
    }
  };

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    isConnected,
    send,
    on,
    off,
    connect,
    disconnect,
  };
}
