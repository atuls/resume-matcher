/**
 * WebSocket service for real-time updates from the server
 */

// Event types for batch analysis
export type BatchAnalysisEvent = 
  | { type: 'batchAnalysisStart', jobId: string, total: number, message: string }
  | { type: 'batchAnalysisProgress', jobId: string, current: number, total: number, progress: number, message: string }
  | { type: 'batchAnalysisResumeStatus', jobId: string, resumeId: string, status: string, message: string, score?: number }
  | { type: 'batchAnalysisComplete', jobId: string, total: number, successful: number, failed: number, message: string };

export type WebSocketEvent = BatchAnalysisEvent | { type: 'info', message: string };

// Event listener type
type EventListener = (event: WebSocketEvent) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Map<string, EventListener[]> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  // Initialize and connect to the WebSocket server
  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
    
    try {
      // Determine the WebSocket URL based on the current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }
  
  // Handle WebSocket open event
  private handleOpen(event: Event) {
    console.log('WebSocket connection established');
    this.reconnectAttempts = 0;
    
    // Dispatch connection event to listeners
    this.dispatchEvent({
      type: 'info',
      message: 'WebSocket connected'
    });
  }
  
  // Handle incoming WebSocket messages
  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);
      
      // Add better debug logging for batch analysis events
      if (data.type && ['batchAnalysisStart', 'batchAnalysisProgress', 'batchAnalysisComplete'].includes(data.type)) {
        console.log(`BATCH ANALYSIS EVENT: ${data.type}`, data);
      }
      
      // Dispatch the event to all listeners
      this.dispatchEvent(data as WebSocketEvent);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error, event.data);
    }
  }
  
  // Handle WebSocket close event
  private handleClose(event: CloseEvent) {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    
    // Attempt to reconnect
    this.attemptReconnect();
    
    // Dispatch close event to listeners
    this.dispatchEvent({
      type: 'info',
      message: 'WebSocket disconnected'
    });
  }
  
  // Handle WebSocket error event
  private handleError(event: Event) {
    console.error('WebSocket error:', event);
    
    // Dispatch error event to listeners
    this.dispatchEvent({
      type: 'info',
      message: 'WebSocket error occurred'
    });
  }
  
  // Attempt to reconnect to the WebSocket server
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Maximum reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, delay);
  }
  
  // Add an event listener
  addEventListener(event: string, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const eventListeners = this.listeners.get(event)!;
    eventListeners.push(listener);
  }
  
  // Remove an event listener
  removeEventListener(event: string, listener: EventListener) {
    if (!this.listeners.has(event)) {
      return;
    }
    
    const eventListeners = this.listeners.get(event)!;
    const index = eventListeners.indexOf(listener);
    
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }
  }
  
  // Dispatch an event to all listeners
  private dispatchEvent(event: WebSocketEvent) {
    // Dispatch to specific event type listeners
    if (this.listeners.has(event.type)) {
      const eventListeners = this.listeners.get(event.type)!;
      eventListeners.forEach(listener => listener(event));
    }
    
    // Dispatch to 'all' event listeners
    if (this.listeners.has('all')) {
      const allListeners = this.listeners.get('all')!;
      allListeners.forEach(listener => listener(event));
    }
  }
  
  // Send a message to the server
  send(data: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket is not connected');
      return false;
    }
    
    try {
      this.socket.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }
  
  // Register for a specific event type
  register(event: string) {
    return this.send({
      type: 'register',
      event
    });
  }
  
  // Disconnect from the WebSocket server
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.reconnectAttempts = 0;
  }
}

// Create and export a singleton instance
const websocketService = new WebSocketService();
export default websocketService;