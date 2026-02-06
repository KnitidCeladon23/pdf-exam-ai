import '@testing-library/jest-dom';

// Mock EventSource for SSE tests
class MockEventSource {
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  readyState: number = 0;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    this.readyState = this.CONNECTING;
    
    // Simulate async connection opening
    setTimeout(() => {
      if (this.readyState === this.CLOSED) return;
      
      this.readyState = this.OPEN;
      this.onopen?.(new Event('open'));
      
      // Send messages after connection is open
      if ((global as any).__mockEventSourceBehavior === 'error') {
        setTimeout(() => {
          if (this.readyState !== this.CLOSED) {
            this.onerror?.(new Event('error'));
            this.close();
          }
        }, 10);
      } else if ((global as any).__mockEventSourceData) {
        const data = (global as any).__mockEventSourceData;
        const messages = Array.isArray(data) ? data : [data];
        
        messages.forEach((msg: any, index: number) => {
          setTimeout(() => {
            if (this.readyState === this.OPEN) {
              this.onmessage?.(new MessageEvent('message', { 
                data: JSON.stringify(msg) 
              }));
            }
          }, 10 * (index + 1));
        });
      }
    }, 5);
  }

  close() {
    this.readyState = this.CLOSED;
  }
  
  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') {
      this.onmessage = listener as any;
    } else if (type === 'error') {
      this.onerror = listener as any;
    } else if (type === 'open') {
      this.onopen = listener as any;
    }
  }
  
  removeEventListener() {
    // No-op for tests
  }
}

(global as any).EventSource = MockEventSource;
