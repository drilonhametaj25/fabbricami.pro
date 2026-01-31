import { ref, onMounted, onUnmounted } from 'vue';

export function useWebSocket(url: string) {
  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const messageListeners = new Map<string, Set<(data: any) => void>>();

  const connect = () => {
    try {
      ws.value = new WebSocket(url);

      ws.value.onopen = () => {
        isConnected.value = true;
        console.log('WebSocket connected');
      };

      ws.value.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const listeners = messageListeners.get(message.type);
          if (listeners) {
            listeners.forEach(callback => callback(message.data));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.value.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.value.onclose = () => {
        isConnected.value = false;
        console.log('WebSocket disconnected');
        
        // Reconnect after 5 seconds
        setTimeout(() => {
          if (!isConnected.value) {
            connect();
          }
        }, 5000);
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
    }
  };

  const disconnect = () => {
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
      console.warn('WebSocket not connected, cannot send message');
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
