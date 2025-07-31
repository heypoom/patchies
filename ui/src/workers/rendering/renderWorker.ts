// Simple rendering worker for testing communication
self.onmessage = (event) => {
  console.log('Worker received message:', event.data)
  
  // Send hello world message back to main thread
  self.postMessage({
    type: 'hello',
    message: 'Hello world from rendering worker!',
    timestamp: Date.now()
  })
}

// Send initial message when worker starts
self.postMessage({
  type: 'ready',
  message: 'Rendering worker initialized',
  timestamp: Date.now()
})