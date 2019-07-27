/* global location */
'use strict'

const IPFS = require('ipfs')

// Libp2p def
const pLibp2pBundle = require('./pnet-bundle.js')
const repo = 'ipfs-' + Math.random()
const swarmKey = '/key/swarm/psk/1.0.0/\n/base16/\n826db2396724c0619a8deb0430c77a3f4af0ed4086785b5e2d5e8f2b13bcd0f4'
console.log("swarmKey: ", swarmKey)

// Node
const $nodeId = document.querySelector('.node-id')
const $nodeAddresses = document.querySelector('.node-addresses')
const $logs = document.querySelector('#logs')
// Peers
const $peers = document.querySelector('#peers')
const $peersList = $peers.querySelector('tbody')
const $multiaddrInput = document.querySelector('#multiaddr-input')
const $connectButton = document.querySelector('#peer-btn')
// Files
const $multihashInput = document.querySelector('#multihash-input')
const $fetchButton = document.querySelector('#fetch-btn')
const $dragContainer = document.querySelector('#drag-container')
const $progressBar = document.querySelector('#progress-bar')
const $fileHistory = document.querySelector('#file-history tbody')
const $emptyRow = document.querySelector('.empty-row')
// Misc
const $allDisabledButtons = document.querySelectorAll('button:disabled')
const $allDisabledInputs = document.querySelectorAll('input:disabled')
const $allDisabledElements = document.querySelectorAll('.disabled')

// Workspace inputs
const $workspaceInput = document.querySelector('#workspace-input')
const $workspaceBtn = document.querySelector('#workspace-btn')

let FILES = []
//let workspace = location.hash

let workspace = 'testWorkspace'

console.log('workespace:',workspace)

let fileSize = 0

let node
let info
let Buffer = IPFS.Buffer

/* ===========================================================================
   Start the IPFS node
   =========================================================================== */

function start() {
  //if (!node) {
  const options = {
    EXPERIMENTAL: {
      pubsub: true
    },
   libp2p: pLibp2pBundle(swarmKey),
    repo: repo,
    config: {
      // // Addresses: {
      // //   //API: ['/ip4/127.0.0.1/tcp/5002'],
      // //   Swarm: [
      // //     //'/ip4/0.0.0.0/tcp/9010/ws'
      // //   //'/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
      // //   ]
      // // },
      // Bootstrap: [
      //   '/ip4/129.211.127.83/tcp/4003/ws/ipfs/QmXt4bwenzr8apvhE1Lkn2HjKcdT5EZppk5P1TK9rr8B9v'
      // ],
      Discovery: {
        MDNS: {
          Enabled: true,
          Interval: 10
        }
      }
    }
  }

  node = new IPFS(options)

  node.once('start', () => {
    node.id()
      .then((id) => {
        info = id
        node.bootstrap.list((err, res) => {
          if (err) {
            console.log(err)
          }
          console.log(res.addr)
        })
        updateView('ready', node)
        onSuccess('Node is ready.')
        setInterval(refreshPeerList, 1000)
        setInterval(sendFileList, 2000)
      })
      .catch((error) => onError(error))

    subscribeToWorkpsace()

    window.addEventListener('hashchange', workspaceUpdated)
  })
  //}
}

/* ===========================================================================
   Pubsub
   =========================================================================== */

const messageHandler = (message) => {
  const myNode = info.id
  const hash = message.data.toString()
  const messageSender = message.from

  // append new files when someone uploads them
  if (myNode !== messageSender && !isFileInList(hash)) {
    $multihashInput.value = hash
    getFile()
  }
}

const subscribeToWorkpsace = () => {
  node.pubsub.subscribe(workspace, messageHandler)
    .then(() => {
      const msg = `Subscribed to workspace ${workspace}`
      $logs.innerHTML = msg
    })
    .catch(() => onError('An error occurred when subscribing to the workspace.'))
}

// unsubscribe from old workspace and re-subscribe to new one
const workspaceUpdated = () => {
  node.pubsub.unsubscribe(workspace).then(() => {
    // clear files from old workspace
    FILES = []
    $fileHistory.innerHTML = ''

    workspace = location.hash
    subscribeToWorkpsace()
  })
}

const publishHash = (hash) => {
  const data = Buffer.from(hash)

  node.pubsub.publish(workspace, data)
    .catch(() => onError('An error occurred when publishing the message.'))
}

/* ===========================================================================
   Files handling
   =========================================================================== */

const isFileInList = (hash) => FILES.indexOf(hash) !== -1

const sendFileList = () => FILES.forEach((hash) => publishHash(hash))

const updateProgress = (bytesLoaded) => {
  let percent = 100 - ((bytesLoaded / fileSize) * 100)

  $progressBar.style.transform = `translateX(${-percent}%)`
}

const resetProgress = () => {
  $progressBar.style.transform = 'translateX(-100%)'
}

function appendFile(name, hash, size, data) {
  const file = new window.Blob([data], { type: 'application/octet-binary' })
  const url = window.URL.createObjectURL(file)
  const row = document.createElement('tr')

  const nameCell = document.createElement('td')
  nameCell.innerHTML = name

  const hashCell = document.createElement('td')
  hashCell.innerHTML = hash

  const sizeCell = document.createElement('td')
  sizeCell.innerText = size

  const downloadCell = document.createElement('td')
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', name)
  link.innerHTML = '<img width=20 class="table-action" src="assets/download.svg" alt="Download" />'
  downloadCell.appendChild(link)

  row.appendChild(nameCell)
  row.appendChild(hashCell)
  row.appendChild(sizeCell)
  row.appendChild(downloadCell)

  $fileHistory.insertBefore(row, $fileHistory.firstChild)

  publishHash(hash)
}

function getFile() {
  const hash = $multihashInput.value

  $multihashInput.value = ''

  if (!hash) {
    return onError('No multihash was inserted.')
  } else if (isFileInList(hash)) {
    return onSuccess('The file is already in the current workspace.')
  }

  FILES.push(hash)

  node.get(hash)
    .then((files) => {
      files.forEach((file) => {
        if (file.content) {
          appendFile(file.name, hash, file.size, file.content)
          onSuccess(`The ${file.name} file was added.`)
          $emptyRow.style.display = 'none'
        }
      })
    })
    .catch(() => onError('An error occurred when fetching the files.'))
}

/* Drag & Drop
   =========================================================================== */

const onDragEnter = () => $dragContainer.classList.add('dragging')

const onDragLeave = () => $dragContainer.classList.remove('dragging')

function onDrop(event) {
  onDragLeave()
  event.preventDefault()

  const dt = event.dataTransfer
  const filesDropped = dt.files

  function readFileContents(file) {
    return new Promise((resolve) => {
      const reader = new window.FileReader()
      reader.onload = (event) => resolve(event.target.result)
      reader.readAsArrayBuffer(file)
    })
  }

  const files = []
  for (let i = 0; i < filesDropped.length; i++) {
    files.push(filesDropped[i])
  }

  files.forEach((file) => {
    readFileContents(file)
      .then((buffer) => {
        fileSize = file.size

        node.add({
          path: file.name,
          content: Buffer.from(buffer)
        }, { wrapWithDirectory: true, progress: updateProgress }, (err, filesAdded) => {
          if (err) {
            return onError(err)
          }

          // As we are wrapping the content we use that hash to keep
          // the original file name when adding it to the table
          $multihashInput.value = filesAdded[1].hash

          resetProgress()
          getFile()
        })
      })
      .catch(onError)
  })
}

/* ===========================================================================
   Peers handling
   =========================================================================== */

function connectToPeer(event) {
  const multiaddr = $multiaddrInput.value

  if (!multiaddr) {
    return onError('No multiaddr was inserted.')
  }

  node.swarm.connect(multiaddr)
    .then(() => {
      onSuccess(`Successfully connected to peer.`)
      $multiaddrInput.value = ''
    })
    .catch(() => onError('An error occurred when connecting to the peer.'))
}

function refreshPeerList() {
  node.swarm.peers()
    .then((peers) => {
      const peersAsHtml = peers.reverse()
        .map((peer) => {
          if (peer.addr) {
            const addr = peer.addr.toString()
            if (addr.indexOf('ipfs') >= 0) {
              return addr
            } else {
              return addr + peer.peer.id.toB58String()
            }
          }
        })
        .map((addr) => {
          return `<tr><td>${addr}</td></tr>`
        }).join('')

      $peersList.innerHTML = peersAsHtml
    })
    .catch((error) => onError(error))
}

/* ===========================================================================
   Error handling
   =========================================================================== */

function onSuccess(msg) {
  $logs.classList.add('success')
  $logs.innerHTML = msg
}

function onError(err) {
  let msg = 'An error occured, check the dev console'

  if (err.stack !== undefined) {
    msg = err.stack
  } else if (typeof err === 'string') {
    msg = err
  }

  $logs.classList.remove('success')
  $logs.innerHTML = msg
}

window.onerror = onError

/* ===========================================================================
   App states
   =========================================================================== */

const states = {
  ready: () => {
    const addressesHtml = info.addresses.map((address) => {
      return `<li><pre>${address}</pre></li>`
    }).join('')
    $nodeId.innerText = info.id
    $nodeAddresses.innerHTML = addressesHtml
    $allDisabledButtons.forEach(b => { b.disabled = false })
    $allDisabledInputs.forEach(b => { b.disabled = false })
    $allDisabledElements.forEach(el => { el.classList.remove('disabled') })
  }
}

function updateView(state, ipfs) {
  if (states[state] !== undefined) {
    states[state]()
  } else {
    throw new Error('Could not find state "' + state + '"')
  }
}

/* ===========================================================================
   Boot the app
   =========================================================================== */

const startApplication = () => {
  // Setup event listeners
  $dragContainer.addEventListener('dragenter', onDragEnter)
  $dragContainer.addEventListener('dragover', onDragEnter)
  $dragContainer.addEventListener('drop', onDrop)
  $dragContainer.addEventListener('dragleave', onDragLeave)
  $fetchButton.addEventListener('click', getFile)
  $connectButton.addEventListener('click', connectToPeer)
  $workspaceBtn.addEventListener('click', () => {
    window.location.hash = $workspaceInput.value
  })

  start()
}

startApplication()
