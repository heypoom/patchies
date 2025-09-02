# 35. Netsend and Netrecv

Let's create two objects: `netsend <chan>` and `netrecv <chan>`. We want to send the JSON data over wire using the `p2pkit` library, and using the trackers in `trackersAnnounceURLs`.

Use the below code sample as inspiration. The below code sample only handles MIDI, but for us we can handle a more generic JSON data.

```tsx
/* global p2pkit, Vue */

Vue.component('port-selector', {
  template: '#port-selector',
  props: ['available', 'selected'],
  computed: {
    options() {
      return [
        {key: null, text: 'None selected', selected: this.selected === null},
        ...this.available.map((item) => ({
          key: item.key,
          text: item.name,
          selected: this.selected === item.key,
        })),
      ]
    },
  },
  methods: {
    select(option) {
      this.$emit('select', option.key)
    },
  },
})

const trackersAnnounceURLs = [
  'wss://tracker.btorrent.xyz',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.fastcast.nz',
  'wss://tracker.sloppyta.co:443/',
  'wss://tracker.novage.com.ua:443/',
  'wss://spacetradersapi-chatbox.herokuapp.com:443/announce',
  'wss://tracker.files.fm:7073/announce',
]
const peers = new Set()

let roomId
const roomIdMatch = location.hash.match(/^\#?([a-zA-Z0-9-]+)/)
if (roomIdMatch) {
  roomId = roomIdMatch[1]
} else {
  roomId = crypto.randomUUID()
  location.replace('#' + roomId)
}

const p2pt = new p2pkit.P2PT(trackersAnnounceURLs, roomId)

const app = new Vue({
  el: '#app',
  data: {
    baseUrl: location.href.replace(/[\?#].*/, ''),
    error: null,
    selectedInput: null,
    selectedOutput: null,
    availableInputs: [],
    availableOutputs: [],
    currentInputPort: null,
    currentOutputPort: null,
    received: 0,
    sent: 0,
    activeConnections: 0,
  },
  computed: {
    url() {
      return this.baseUrl + '#' + roomId
    },
    currentInput() {
      return this.selectedInput
    },
    currentOutput() {
      return this.selectedOutput
    },
  },
  watch: {
    selectedInput: {
      handler(nextValue, currentValue) {
        this.currentInputPort =
          nextValue != null ? this.midiAccess.inputs.get(nextValue) : null
        console.log('currentInputPort =>', this.currentInputPort)
      },
      immediate: true,
    },
    selectedOutput: {
      handler(nextValue, currentValue) {
        this.currentOutputPort =
          nextValue != null ? this.midiAccess.outputs.get(nextValue) : null
        console.log('currentOutputPort =>', this.currentOutputPort)
      },
      immediate: true,
    },
    currentInputPort: {
      handler(nextValue, currentValue) {
        if (currentValue) {
          currentValue.onmidimessage = () => {}
        }
        if (nextValue) {
          nextValue.onmidimessage = (e) => {
            this.sent++
            peers.forEach((peer) => {
              p2pt.send(peer, {data: [...e.data]})
            })
          }
        }
      },
      immediate: true,
    },
  },
  async mounted() {
    const updateStats = () => {
      this.activeConnections = peers.size
    }
    p2pt.on('trackerwarning', (error, stats) => {
      console.warn('trackerwarning =>', error, stats)
    })
    p2pt.on('trackerconnect', (tracker, stats) => {
      console.log('trackerconnect =>', tracker, stats)
    })
    p2pt.on('peerconnect', (peer) => {
      console.log('peerconnect =>', peer)
      peers.add(peer)
      updateStats()
    })
    p2pt.on('peerclose', (peer) => {
      console.log('peerclose =>', peer)
      peers.delete(peer)
      updateStats()
    })
    p2pt.on('msg', (peer, message) => {
      console.log('received <= ' + message.data)
      this.received++
      if (this.currentOutputPort) {
        this.currentOutputPort.send(message.data)
      }
    })
    p2pt.start()
    window.p2pt = this.p2pt = p2pt
    try {
      const access = (this.midiAccess = await navigator.requestMIDIAccess({
        sysex: false,
      }))
      const refreshPorts = () => {
        this.availableInputs = getKeys(access.inputs).map((key) => ({
          key,
          name: access.inputs.get(key).name,
        }))
        this.availableOutputs = getKeys(access.outputs).map((key) => ({
          key,
          name: access.outputs.get(key).name,
        }))
      }
      access.onstatechange = refreshPorts
      refreshPorts()
    } catch (e) {
      this.error = 'Failed to request MIDI access! ' + e
    }
  },
})

function getKeys(portMap) {
  const keys = []
  const iterator = portMap.keys()
  for (;;) {
    const {done, value: key} = iterator.next()
    if (done) break
    keys.push(key)
  }
  return keys
}
```
